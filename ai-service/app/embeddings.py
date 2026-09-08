"""
M3 - Vector Embedding & Indexing Module
sentence-transformers (embeddings) · Qdrant (HNSW vector index,
free/self-hosted equivalent of Pinecone)

Converts transcript segments into vector embeddings tied to exact
video timestamps and indexes them in Qdrant (HNSW) for fast,
context-aware retrieval.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings
from .ingestion import VideoTranscript

# Qdrant Cloud runs many sequential HTTP requests during a batched upload
# (one per BATCH_SIZE chunk of vectors) — a single dropped/reset TCP
# connection on any one of them used to kill the entire training run.
# Retries on ANY exception here deliberately, not just specific network
# error types: qdrant-client wraps the underlying httpx/httpcore errors
# in its own ResponseHandlingException class, so a narrow isinstance
# check against ConnectionError/OSError never actually matched and the
# retry silently never fired. These calls (get_collections, upsert) are
# safe to retry — worst case they're idempotent no-ops.
network_retry = retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)

_model: SentenceTransformer | None = None
_client: QdrantClient | None = None

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
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


def _collection_name(twin_id: str) -> str:
    return f"youtwin_{twin_id}"


@network_retry
def ensure_collection(twin_id: str) -> None:
    client = _get_client()
    name = _collection_name(twin_id)
    existing = [c.name for c in client.get_collections().collections]
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(
                size=EMBEDDING_DIM,
                distance=qmodels.Distance.COSINE,
                hnsw_config=qmodels.HnswConfigDiff(m=16, ef_construct=100),
            ),
        )


@dataclass
class IndexedChunk:
    text: str
    video_id: str
    video_title: str
    timestamp_seconds: int


def _chunk_transcript(transcript: VideoTranscript, window: int = 3) -> list[IndexedChunk]:
    """Group consecutive caption/whisper segments into ~window-sized
    chunks so each embedded vector carries enough context, while still
    keeping a precise timestamp anchor."""
    chunks: list[IndexedChunk] = []
    segs = transcript.segments
    for i in range(0, len(segs), window):
        group = segs[i:i + window]
        if not group:
            continue
        text = " ".join(s.text for s in group)
        chunks.append(IndexedChunk(
            text=text,
            video_id=transcript.video_id,
            video_title=transcript.title,
            timestamp_seconds=group[0].start_seconds,
        ))
    return chunks


def embed_and_index(twin_id: str, transcripts: list[VideoTranscript]) -> int:
    """Embeds all transcript chunks and upserts them into the twin's
    Qdrant collection. Returns number of chunks indexed."""
    ensure_collection(twin_id)
    model = _get_model()
    client = _get_client()

    all_chunks: list[IndexedChunk] = []
    for t in transcripts:
        all_chunks.extend(_chunk_transcript(t))

    if not all_chunks:
        return 0

    vectors = model.encode([c.text for c in all_chunks], show_progress_bar=False)

    points = [
        qmodels.PointStruct(
            id=str(uuid.uuid4()),
            vector=vector.tolist(),
            payload={
                "text": chunk.text,
                "video_id": chunk.video_id,
                "video_title": chunk.video_title,
                "timestamp_seconds": chunk.timestamp_seconds,
            },
        )
        for chunk, vector in zip(all_chunks, vectors)
    ]

    _upsert_in_batches(client, _collection_name(twin_id), points)
    return len(points)


BATCH_SIZE = 64


def _upsert_in_batches(client: QdrantClient, collection: str, points: list) -> None:
    """Uploads points in small batches instead of one giant request, since
    large channels can produce thousands of chunks and a single bulk
    upsert can exceed the write timeout."""
    for i in range(0, len(points), BATCH_SIZE):
        batch = points[i:i + BATCH_SIZE]
        _upsert_one_batch(client, collection, batch)


@network_retry
def _upsert_one_batch(client: QdrantClient, collection: str, batch: list) -> None:
    client.upsert(collection_name=collection, points=batch)


def search(twin_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Retrieves the top-k most relevant transcript chunks for a query,
    with similarity scores used downstream as the RAG confidence signal."""
    model = _get_model()
    client = _get_client()
    vector = model.encode(query).tolist()

    try:
        hits = client.search(
            collection_name=_collection_name(twin_id),
            query_vector=vector,
            limit=top_k,
        )
    except Exception:
        return []

    return [
        {
            "text": h.payload["text"],
            "video_id": h.payload["video_id"],
            "video_title": h.payload["video_title"],
            "timestamp_seconds": h.payload["timestamp_seconds"],
            "score": h.score,
        }
        for h in hits
    ]


def browse_moments(twin_id: str, limit: int = 12) -> list[dict]:
    """Powers the Topic Explorer — returns a spread of indexed moments
    from across the creator's videos without needing a query, using
    Qdrant's scroll (not search) since we're browsing, not matching.
    Reuses the same collection `search` already relies on."""
    client = _get_client()
    try:
        points, _ = client.scroll(
            collection_name=_collection_name(twin_id),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    except Exception:
        return []

    return [
        {
            "text": p.payload["text"],
            "video_id": p.payload["video_id"],
            "video_title": p.payload["video_title"],
            "timestamp_seconds": p.payload["timestamp_seconds"],
        }
        for p in points
    ]