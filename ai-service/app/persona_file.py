"""
M2 - Stylometric Extraction Module, part 2: the persona definition file.

spaCy (stylometry.py) measures HOW the creator talks — sentence length,
pace, vocabulary, catchphrases. This module uses LlamaIndex to turn the
raw transcripts into sentence-level nodes, picks the lines that best
carry that voice (style exemplars), and packages everything into a
single persona definition file: a LlamaIndex Document whose text is the
persona card and whose metadata is the measured profile.

The exemplars are fed back into the RAG system prompt (style reference
only — facts still come exclusively from retrieved context), and the
file itself is downloadable by the creator from the Review screen.

LlamaIndex is imported lazily and optionally: if it is missing, a plain
regex sentence splitter is used so training never fails because of it.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from .schemas import PersonaProfile

logger = logging.getLogger("youtwin.persona_file")

FORMAT = "youtwin.persona/v1"
MAX_EXEMPLARS = 5


def _split_sentences_llamaindex(texts: list[tuple[str, str]]) -> list[str] | None:
    try:
        from llama_index.core import Document
        from llama_index.core.node_parser import SentenceSplitter
    except Exception:  # pragma: no cover - optional dependency
        return None
    try:
        docs = [Document(text=t) for _, t in texts if t.strip()]
        # Small chunks => each node is ~1-2 spoken sentences.
        splitter = SentenceSplitter(chunk_size=50, chunk_overlap=0)
        nodes = splitter.get_nodes_from_documents(docs)
        return [n.get_content().strip() for n in nodes if n.get_content().strip()]
    except Exception:
        logger.exception("LlamaIndex sentence splitting failed; using regex fallback")
        return None


def _split_sentences_regex(texts: list[tuple[str, str]]) -> list[str]:
    out: list[str] = []
    for _, t in texts:
        out.extend(s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if s.strip())
    return out


def select_style_exemplars(
    texts: list[tuple[str, str]],
    top_vocabulary: list[str],
    catchphrases: list[str],
    tone_words: set[str],
    limit: int = MAX_EXEMPLARS,
) -> tuple[list[str], str]:
    """Returns (exemplar lines, splitter used). `texts` is (title, text)."""
    sentences = _split_sentences_llamaindex(texts)
    splitter = "llama_index.SentenceSplitter"
    if sentences is None:
        sentences = _split_sentences_regex(texts)
        splitter = "regex"

    vocab = set(top_vocabulary[:15])
    scored: list[tuple[float, str]] = []
    seen: set[str] = set()
    for sent in sentences:
        words = re.findall(r"[a-zA-Z']+", sent.lower())
        if not 6 <= len(words) <= 50:
            continue
        key = " ".join(words)
        if key in seen:
            continue
        seen.add(key)
        low = sent.lower()
        score = (
            sum(1 for w in words if w in vocab)
            + 2 * sum(1 for c in catchphrases if c and c in low)
            + sum(1 for w in words if w in tone_words)
        ) / (len(words) ** 0.5)
        if score > 0:
            scored.append((score, re.sub(r"\s+", " ", sent)))

    scored.sort(key=lambda x: x[0], reverse=True)
    picked: list[str] = []
    picked_words: list[set[str]] = []
    for _, sent in scored:
        words = set(re.findall(r"[a-zA-Z']+", sent.lower()))
        # skip near-duplicates of a line already picked
        if any(len(words & w) / max(len(words | w), 1) > 0.6 for w in picked_words):
            continue
        picked.append(sent)
        picked_words.append(words)
        if len(picked) >= limit:
            break
    return picked, splitter


def _persona_card(p: PersonaProfile) -> str:
    lines = [
        f"# Persona definition — {p.creator_name}",
        "",
        f"Tone: {', '.join(p.tone_descriptors) or 'neutral'}",
        f"Average sentence length: {p.avg_sentence_length} words",
        f"Speaking pace: {p.speaking_pace_wpm} words per minute",
        f"Signature vocabulary: {', '.join(p.top_vocabulary) or '—'}",
        f"Catchphrases: {'; '.join(p.catchphrases) or '—'}",
        f"Opening line: {p.sample_opening_line or '—'}",
        "",
        "## Style exemplars",
        *[f"- {e}" for e in p.style_exemplars],
        "",
        "## Guardrails",
        "- Answer only from indexed video context; refuse below the confidence threshold.",
        "- Stay in the creator's voice; never invent facts, products or opinions.",
    ]
    return "\n".join(lines)


def build_definition(persona: PersonaProfile) -> dict:
    """The downloadable persona definition file."""
    profile = persona.model_dump()
    card = _persona_card(persona)
    document = None
    try:
        from llama_index.core import Document

        document = Document(
            text=card,
            metadata={"format": FORMAT, "twin_id": persona.twin_id, "creator_name": persona.creator_name},
        ).to_dict()
    except Exception:  # pragma: no cover - optional dependency
        document = {"text": card, "metadata": {"format": FORMAT, "twin_id": persona.twin_id}}

    return {
        "format": FORMAT,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_with": ["spaCy (stylometry)", "LlamaIndex (sentence nodes + persona Document)"],
        "profile": profile,
        "persona_card": card,
        "llama_index_document": document,
    }
