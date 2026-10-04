"""
M3 - Vector Embedding & Indexing Module
sentence-transformers (embeddings) · Qdrant (HNSW vector index + BM25
keyword index, free/self-hosted equivalent of Pinecone)

Converts transcript segments into overlapping, sentence-sized chunks
tied to exact video timestamps and indexes each chunk twice in one
Qdrant collection:

  dense  - a BGE-small sentence embedding (meaning: "PSU" ~ "power supply")
  bm25   - a sparse keyword vector, IDF-weighted by Qdrant (exact terms:
           model numbers, names, prices — things embeddings blur)

search() runs both and fuses the rankings (Reciprocal Rank Fusion), so a
question is found whether the viewer paraphrases the creator or quotes
an exact product name.

Twins indexed by the first version of this module (MiniLM vectors,
3-caption chunks, collection "youtwin_<id>") are upgraded in place the
first time they are searched: the stored transcript text is re-chunked
and re-embedded into the new collection, so creators never retrain.
"""
from __future__ import annotations

import logging
import math
import re
import threading
import uuid
import zlib
from collections import Counter, defaultdict
from dataclasses import dataclass

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings
from .ingestion import TranscriptSegment, VideoTranscript

logger = logging.getLogger("youtwin.embeddings")

# Qdrant Cloud runs many sequential HTTP requests during a batched upload
# (one per BATCH_SIZE chunk of vectors) — a single dropped/reset TCP
# connection on any one of them used to kill the entire training run.
# Retries on ANY exception here deliberately, not just specific network
# error types: qdrant-client wraps the underlying httpx/httpcore errors
# in its own ResponseHandlingException class, so a narrow isinstance
# check against ConnectionError/OSError never actually matched and the
# retry silently never fired. These calls are safe to retry — point ids
# are deterministic, so a repeated upsert overwrites instead of
# duplicating.
network_retry = retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)

DENSE = "dense"
SPARSE = "bm25"

# Chunking: ~90 words (~35-45 s of speech) with ~25 words of overlap, cut
# on caption boundaries so every chunk keeps an exact start timestamp. A
# fact that straddles a boundary still lands whole in one chunk.
CHUNK_WORDS = 90
CHUNK_MAX_SECONDS = 75
OVERLAP_WORDS = 25

# Small-to-big: each chunk is also indexed as ~WINDOW_WORDS "windows"
# (half-overlapping runs of caption lines). A question about one fact
# matches its window sharply instead of being diluted by the rest of the
# chunk; the LLM still gets the whole parent chunk as context.
WINDOW_WORDS = 30

# Candidate points pulled from each index before fusion (windows and
# chunks together, grouped by parent chunk afterwards).
CANDIDATES = 40
RRF_K = 60
SPARSE_WEIGHT = 0.7   # keyword ranking weight vs meaning (tuned on an eval set)

_model: SentenceTransformer | None = None
_client: QdrantClient | None = None
_model_lock = threading.Lock()


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer(settings.embedding_model)
    return _model


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=120,
        )
    return _client


def _query_prefix() -> str:
    # BGE models are trained with this instruction on the query side only.
    return "Represent this sentence for searching relevant passages: " if "bge" in settings.embedding_model.lower() else ""


def _encode_docs(texts: list[str]) -> np.ndarray:
    return np.asarray(_get_model().encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=32))


def _encode_query(text: str) -> np.ndarray:
    return np.asarray(_get_model().encode(_query_prefix() + text, normalize_embeddings=True, show_progress_bar=False))


# ---------------------------------------------------------------- names

def _collection_name(twin_id: str) -> str:
    return f"youtwin2_{twin_id}"


def _legacy_collection_name(twin_id: str) -> str:
    return f"youtwin_{twin_id}"


_ready: set[str] = set()                       # twins known to have a current index
_migrate_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


@network_retry
def _exists(name: str) -> bool:
    return _get_client().collection_exists(name)


def _readable_collection(twin_id: str) -> str | None:
    """Whichever collection holds this twin's chunks, without upgrading.
    (Payloads in both versions carry text / video / timestamp.)"""
    if twin_id in _ready:
        return _collection_name(twin_id)
    for name in (_collection_name(twin_id), _legacy_collection_name(twin_id)):
        try:
            if _exists(name):
                return name
        except Exception as exc:
            logger.info("collection check failed for %s: %s", name, exc)
            return None
    return None


def _searchable_collection(twin_id: str) -> str | None:
    """The current-format collection, upgrading a legacy one on first use."""
    if twin_id in _ready:
        return _collection_name(twin_id)
    new = _collection_name(twin_id)
    if _exists(new):
        _ready.add(twin_id)
        return new
    if not _exists(_legacy_collection_name(twin_id)):
        return None
    with _migrate_locks[twin_id]:
        if twin_id in _ready:
            return new
        _migrate_legacy(twin_id)
    return new


# ---------------------------------------------------------------- chunking

@dataclass
class IndexedChunk:
    text: str
    video_id: str
    video_title: str
    timestamp_seconds: int
    end_seconds: int
    index: int
    segments: list[tuple[int, str]]


def _chunk_transcript(transcript: VideoTranscript) -> list[IndexedChunk]:
    """Overlapping ~CHUNK_WORDS windows built from whole caption segments."""
    segs = [s for s in transcript.segments if s.text and s.text.strip()]
    if not segs:
        return []
    lens = [len(s.text.split()) for s in segs]
    chunks: list[IndexedChunk] = []
    i = 0
    while i < len(segs):
        j, words = i, 0
        while j < len(segs) and (j == i or words < CHUNK_WORDS):
            if j > i and segs[j].start_seconds - segs[i].start_seconds > CHUNK_MAX_SECONDS and words >= CHUNK_WORDS // 2:
                break
            words += lens[j]
            j += 1
        # Don't leave a tiny tail chunk: absorb it into this one.
        if j < len(segs) and sum(lens[j:]) < CHUNK_WORDS // 3:
            j = len(segs)
        group = segs[i:j]
        end = segs[j].start_seconds if j < len(segs) else group[-1].start_seconds + 4
        chunks.append(IndexedChunk(
            text=" ".join(s.text.strip() for s in group),
            video_id=transcript.video_id,
            video_title=transcript.title,
            timestamp_seconds=int(group[0].start_seconds),
            end_seconds=int(end),
            index=len(chunks),
            segments=[(int(s.start_seconds), s.text.strip()) for s in group],
        ))
        if j >= len(segs):
            break
        k, back = j, 0
        while k - 1 > i and back < OVERLAP_WORDS:
            k -= 1
            back += lens[k]
        i = max(k, i + 1)
    return chunks


def _windows(chunk: IndexedChunk) -> list[str]:
    """Half-overlapping ~WINDOW_WORDS runs of the chunk's caption lines."""
    segs = [x for _, x in chunk.segments]
    if sum(len(x.split()) for x in segs) <= WINDOW_WORDS * 1.5:
        return []                                   # the chunk is already small
    out, i = [], 0
    while i < len(segs):
        j, words = i, 0
        while j < len(segs) and words < WINDOW_WORDS:
            words += len(segs[j].split())
            j += 1
        out.append(" ".join(segs[i:j]))
        if j >= len(segs):
            break
        k, back = j, 0                                # step back ~half a window
        while k - 1 > i and back < WINDOW_WORDS // 2:
            k -= 1
            back += len(segs[k].split())
        i = max(k, i + 1)
    return out


def _embed_text(chunk: IndexedChunk) -> str:
    # The title gives short caption chunks their topic ("it gets 65 fps"
    # -> which game? which PC?).
    return f"{chunk.video_title}. {chunk.text}"


# ---------------------------------------------------------------- BM25

_STOP = {
    "a", "about", "after", "all", "also", "am", "an", "and", "any", "are", "as", "at", "be",
    "because", "been", "but", "by", "can", "could", "did", "do", "does", "doing", "don", "for",
    "from", "get", "got", "had", "has", "have", "he", "her", "here", "him", "his", "how", "i",
    "if", "in", "into", "is", "it", "its", "just", "let", "like", "me", "more", "my", "of", "on",
    "or", "our", "out", "really", "she", "should", "so", "some", "than", "that", "the", "their",
    "them", "then", "there", "these", "they", "this", "to", "too", "up", "us", "very", "was",
    "we", "were", "what", "when", "where", "which", "who", "why", "will", "with", "would", "you",
    "your", "yours", "guys", "okay", "ok", "um", "uh", "yeah", "basically", "actually",
    "literally", "gonna", "wanna", "tell", "please", "know", "think", "one", "s", "t",
}
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_JOIN_RE = re.compile(r"(?<=[a-z0-9])[.\-'’](?=[a-z0-9])")
BM25_K1, BM25_B, BM25_AVG_LEN = 1.2, 0.75, 55.0

try:  # nltk ships with llama-index-core; stemming is a nice-to-have
    from nltk.stem import PorterStemmer

    _stem = PorterStemmer().stem
except Exception:  # pragma: no cover
    def _stem(word: str) -> str:
        return word


def _terms(text: str) -> list[str]:
    text = _JOIN_RE.sub("", text.lower())          # "M.2" -> "m2", "ZV-1" -> "zv1"
    return [_stem(t) for t in _TOKEN_RE.findall(text) if t not in _STOP and (len(t) > 1 or t.isdigit())]


def _term_id(term: str) -> int:
    return zlib.crc32(term.encode()) & 0x7FFFFFFF


def _sparse_doc(text: str) -> qmodels.SparseVector:
    terms = _terms(text)
    tf = Counter(terms)
    norm = BM25_K1 * (1 - BM25_B + BM25_B * len(terms) / BM25_AVG_LEN)
    vals: dict[int, float] = {}
    for term, n in tf.items():
        vals[_term_id(term)] = vals.get(_term_id(term), 0.0) + n * (BM25_K1 + 1) / (n + norm)
    return qmodels.SparseVector(indices=list(vals), values=list(vals.values()))


def _sparse_query(text: str) -> qmodels.SparseVector:
    ids = sorted({_term_id(t) for t in _terms(text)})
    return qmodels.SparseVector(indices=ids, values=[1.0] * len(ids))


def keyword_overlap(query: str, text: str) -> float:
    """Share of the question's content words that appear in the text (0-1)."""
    q = set(_terms(query))
    if not q:
        return 0.0
    return len(q & set(_terms(text))) / len(q)


# ---------------------------------------------------------------- indexing

@network_retry
def _create_collection(name: str) -> None:
    client = _get_client()
    if client.collection_exists(name):
        client.delete_collection(name)
    client.create_collection(
        collection_name=name,
        vectors_config={DENSE: qmodels.VectorParams(
            size=_get_model().get_sentence_embedding_dimension(),
            distance=qmodels.Distance.COSINE,
            hnsw_config=qmodels.HnswConfigDiff(m=16, ef_construct=100),
        )},
        sparse_vectors_config={SPARSE: qmodels.SparseVectorParams(modifier=qmodels.Modifier.IDF)},
    )
    try:
        client.create_payload_index(name, field_name="video_id", field_schema=qmodels.PayloadSchemaType.KEYWORD)
    except Exception as exc:  # not supported by the in-memory test client
        logger.debug("payload index skipped: %s", exc)


def ensure_collection(twin_id: str) -> None:
    if not _exists(_collection_name(twin_id)):
        _create_collection(_collection_name(twin_id))


def embed_and_index(twin_id: str, transcripts: list[VideoTranscript]) -> int:
    """(Re)builds the twin's index from its transcripts. Returns the number
    of chunks indexed."""
    all_chunks: list[IndexedChunk] = []
    for t in transcripts:
        all_chunks.extend(_chunk_transcript(t))

    name = _collection_name(twin_id)
    _ready.discard(twin_id)
    _create_collection(name)
    if not all_chunks:
        return 0

    # (point id, embed text, sparse text, payload) for every chunk + window
    specs: list[tuple[str, str, str, dict]] = []
    for c in all_chunks:
        parent = str(uuid.uuid5(uuid.NAMESPACE_URL, f"youtwin:{twin_id}:{c.video_id}:{c.index}"))
        specs.append((parent, _embed_text(c), f"{c.video_title} {c.text}", {
            "kind": "chunk",
            "text": c.text,
            "video_id": c.video_id,
            "video_title": c.video_title,
            "timestamp_seconds": c.timestamp_seconds,
            "end_seconds": c.end_seconds,
            "chunk_index": c.index,
            "segments": [[t, x] for t, x in c.segments],
        }))
        for w, text in enumerate(_windows(c)):
            specs.append((
                str(uuid.uuid5(uuid.NAMESPACE_URL, f"youtwin:{twin_id}:{c.video_id}:{c.index}:w{w}")),
                f"{c.video_title}. {text}", f"{c.video_title} {text}",
                {"kind": "window", "parent_id": parent, "video_id": c.video_id, "text": text},
            ))

    vectors = _encode_docs([e for _, e, _, _ in specs])
    points = [
        qmodels.PointStruct(id=pid, vector={DENSE: vec.tolist(), SPARSE: _sparse_doc(sparse_text)}, payload=payload)
        for (pid, _, sparse_text, payload), vec in zip(specs, vectors)
    ]
    _upsert_in_batches(_get_client(), name, points)
    _ready.add(twin_id)

    legacy = _legacy_collection_name(twin_id)
    try:
        if _exists(legacy):
            _get_client().delete_collection(legacy)
    except Exception as exc:
        logger.info("could not drop legacy collection %s: %s", legacy, exc)
    return len(all_chunks)


BATCH_SIZE = 64


def _upsert_in_batches(client: QdrantClient, collection: str, points: list) -> None:
    """Uploads points in small batches instead of one giant request, since
    large channels can produce thousands of chunks and a single bulk
    upsert can exceed the write timeout."""
    for i in range(0, len(points), BATCH_SIZE):
        _upsert_one_batch(client, collection, points[i:i + BATCH_SIZE])


@network_retry
def _upsert_one_batch(client: QdrantClient, collection: str, batch: list) -> None:
    client.upsert(collection_name=collection, points=batch)


def _migrate_legacy(twin_id: str) -> None:
    """One-time upgrade of a first-generation index (see module docstring).
    The stored chunk texts are treated as caption segments, re-chunked and
    re-embedded; the old collection is dropped once the new one is full."""
    legacy = _legacy_collection_name(twin_id)
    payloads = _scroll(legacy)
    by_video: dict[str, dict] = defaultdict(lambda: {"title": "", "segments": []})
    for p in payloads:
        vid = str(p.get("video_id") or "unknown")
        by_video[vid]["title"] = by_video[vid]["title"] or str(p.get("video_title") or vid)
        by_video[vid]["segments"].append(TranscriptSegment(int(p.get("timestamp_seconds") or 0), str(p["text"])))
    transcripts = [
        VideoTranscript(video_id=vid, title=v["title"], source="migrated",
                        segments=sorted(v["segments"], key=lambda s: s.start_seconds))
        for vid, v in by_video.items()
    ]
    try:
        n = embed_and_index(twin_id, transcripts)
    except Exception:
        _ready.discard(twin_id)
        try:
            _get_client().delete_collection(_collection_name(twin_id))
        except Exception:
            pass
        raise
    logger.info("upgraded index for %s: %d legacy chunks -> %d chunks", twin_id, len(payloads), n)


# ---------------------------------------------------------------- search

def _hit(point_id, payload: dict, dense_score: float) -> dict:
    p = payload or {}
    return {
        "id": str(point_id),
        "text": p.get("text", ""),
        "video_id": p.get("video_id", ""),
        "video_title": p.get("video_title", ""),
        "timestamp_seconds": int(p.get("timestamp_seconds") or 0),
        "end_seconds": int(p.get("end_seconds") or p.get("timestamp_seconds") or 0),
        "chunk_index": p.get("chunk_index"),
        "segments": p.get("segments") or [],
        "score": float(dense_score),
    }


def search(twin_id: str, query: str, top_k: int = 5, video_id: str | None = None) -> list[dict]:
    """Hybrid small-to-big retrieval.

    Dense and BM25 searches each return windows and chunks; both are
    grouped by parent chunk (a chunk ranks where its best member ranks) and
    the two rankings are fused with Reciprocal Rank Fusion. Each returned
    chunk carries
      score    - cosine similarity of its best-matching member (window or
                 whole chunk) to the question: the guardrail's evidence
      lexical  - share of the question's content words found in the chunk
      rank     - fused RRF score used for ordering
    With video_id, only that one video is searched."""
    try:
        name = _searchable_collection(twin_id)
    except Exception as exc:
        logger.warning("index unavailable for %s: %s", twin_id, exc)
        return []
    if not name:
        return []

    client = _get_client()
    qv = _encode_query(query)
    flt = None
    if video_id:
        flt = qmodels.Filter(must=[qmodels.FieldCondition(key="video_id", match=qmodels.MatchValue(value=video_id))])

    try:
        dense = client.query_points(
            collection_name=name, query=qv.tolist(), using=DENSE, query_filter=flt,
            limit=CANDIDATES, with_payload=True,
        ).points
        sq = _sparse_query(query)
        sparse = client.query_points(
            collection_name=name, query=sq, using=SPARSE, query_filter=flt,
            limit=CANDIDATES, with_payload=True, with_vectors=[DENSE],
        ).points if sq.indices else []
    except Exception as exc:
        # Still degrade to "no hits" (the guardrail then refuses), but log
        # it — a Qdrant outage used to be indistinguishable from an
        # untrained twin.
        logger.warning("search failed for %s: %s", twin_id, exc)
        return []

    parents: dict[str, dict] = {}     # parent id -> chunk payload (when seen)
    cos: dict[str, float] = {}        # parent id -> best member similarity
    rrf: dict[str, float] = defaultdict(float)

    def parent_of(p) -> str:
        payload = p.payload or {}
        if payload.get("kind") == "window":
            return str(payload.get("parent_id"))
        parents[str(p.id)] = payload
        return str(p.id)

    order: list[str] = []
    for p in dense:
        pid = parent_of(p)
        cos[pid] = max(cos.get(pid, -1.0), float(p.score))
        if pid not in order:
            order.append(pid)
    for rank, pid in enumerate(order):
        rrf[pid] += 1.0 / (RRF_K + rank + 1)

    order = []
    for p in sparse:
        pid = parent_of(p)
        vec = p.vector.get(DENSE) if isinstance(p.vector, dict) else p.vector
        if vec is not None:
            cos[pid] = max(cos.get(pid, -1.0), float(np.dot(qv, np.asarray(vec))))
        if pid not in order:
            order.append(pid)
    for rank, pid in enumerate(order):
        rrf[pid] += SPARSE_WEIGHT / (RRF_K + rank + 1)

    best = sorted(rrf, key=rrf.get, reverse=True)[:max(top_k, 1)]
    missing = [pid for pid in best if pid not in parents]
    if missing:
        try:
            for p in client.retrieve(collection_name=name, ids=missing, with_payload=True):
                parents[str(p.id)] = p.payload or {}
        except Exception as exc:
            logger.warning("could not load chunks for %s: %s", twin_id, exc)

    out = []
    for pid in best:
        payload = parents.get(pid)
        if not payload:
            continue
        h = _hit(pid, payload, cos.get(pid, 0.0))
        h["rank"] = rrf[pid]
        h["lexical"] = keyword_overlap(query, f"{h['video_title']} {h['text']}")
        out.append(h)
    return out


def pinpoint(hit: dict, focus: str, window: int = 3) -> tuple[int, str]:
    """The exact moment inside a ~40 s chunk that best matches `focus`
    (the question plus the answer): the start time and text of the run of
    `window` caption lines sharing the most words with it. Citations then
    jump to the sentence, not to the start of the chunk."""
    segs = hit.get("segments") or []
    if not segs:
        return hit["timestamp_seconds"], hit["text"][:200]
    want = set(_terms(focus))
    best, best_i = -1.0, 0
    for i in range(len(segs)):
        words = set(_terms(" ".join(str(x) for _, x in segs[i:i + window])))
        score = len(want & words) - 0.01 * i      # ties -> earlier line
        if score > best:
            best, best_i = score, i
    start = int(segs[best_i][0])
    text = " ".join(str(x) for _, x in segs[best_i:best_i + window])
    return start, (text[:217] + "...") if len(text) > 220 else text


# ---------------------------------------------------------------- browsing

_CHUNKS_ONLY = qmodels.Filter(must_not=[
    qmodels.FieldCondition(key="kind", match=qmodels.MatchValue(value="window")),
])


@network_retry
def _scroll_page(name: str, limit: int, offset):
    return _get_client().scroll(collection_name=name, limit=limit, offset=offset, with_payload=True,
                                with_vectors=False, scroll_filter=_CHUNKS_ONLY)


def _scroll(name: str, max_points: int = 4000) -> list[dict]:
    out: list[dict] = []
    offset = None
    while len(out) < max_points:
        points, offset = _scroll_page(name, 256, offset)
        out.extend(p.payload for p in points if (p.payload or {}).get("text"))
        if offset is None or not points:
            break
    return out


def browse_moments(twin_id: str, limit: int = 12) -> list[dict]:
    """Powers the Topic Explorer — a spread of indexed moments across the
    creator's videos (round-robin by video, in timeline order), using
    Qdrant's scroll since we're browsing, not matching."""
    name = _readable_collection(twin_id)
    if not name:
        return []
    try:
        payloads = _scroll(name, max_points=600)
    except Exception as exc:
        logger.info("browse_moments: scroll failed for %s: %s", twin_id, exc)
        return []
    by_video: dict[str, list[dict]] = defaultdict(list)
    for p in payloads:
        by_video[p.get("video_id", "")].append(p)
    queues = []
    for items in by_video.values():
        items.sort(key=lambda p: int(p.get("timestamp_seconds") or 0))
        step = max(1, len(items) // max(1, math.ceil(limit / max(1, len(by_video)))))
        queues.append(items[::step])
    picked: list[dict] = []
    while len(picked) < limit and any(queues):
        for q in queues:
            if q and len(picked) < limit:
                picked.append(q.pop(0))
    return [
        {
            "text": p["text"],
            "video_id": p.get("video_id", ""),
            "video_title": p.get("video_title", ""),
            "timestamp_seconds": int(p.get("timestamp_seconds") or 0),
        }
        for p in picked
    ]


def scroll_all_chunks(twin_id: str, max_points: int = 4000) -> list[dict]:
    """Every indexed chunk for a twin (text + video + timestamp). Used to
    rebuild a twin's persona from its existing index when the persona
    record itself has been lost (see recovery.py) — no re-download or
    re-transcription needed."""
    name = _readable_collection(twin_id)
    if not name:
        return []
    try:
        return _scroll(name, max_points)
    except Exception as exc:
        logger.info("scroll_all_chunks: no index for %s (%s)", twin_id, exc)
        return []


@network_retry
def delete_collection(twin_id: str) -> bool:
    """Deletes the twin's Qdrant collections (current and legacy). Returns
    False if neither existed."""
    client = _get_client()
    _ready.discard(twin_id)
    found = False
    for name in (_collection_name(twin_id), _legacy_collection_name(twin_id)):
        if client.collection_exists(name):
            client.delete_collection(collection_name=name)
            found = True
    return found
