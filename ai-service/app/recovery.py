"""
Self-healing for twins whose persona / status records went missing.

Personas used to be stored in Redis with a 24-hour expiry, so every twin
trained before that was fixed silently "forgot" its persona a day later —
the chat endpoint then answered "this twin hasn't finished training yet"
even though all of its transcript vectors were still sitting in Qdrant.
(The in-memory fallback store has the same problem after any restart.)

Rather than making creators retrain, this rebuilds the persona directly
from the twin's existing Qdrant index the first time it's needed, stores
it permanently, and marks the twin's ingest status as ready.
"""
from __future__ import annotations

import logging
from collections import defaultdict

from . import embeddings, store
from .ingestion import TranscriptSegment, VideoTranscript
from .schemas import IngestStatus, PersonaProfile
from .stylometry import extract_persona

logger = logging.getLogger("youtwin.recovery")


def _rebuild(twin_id: str, creator_name: str | None) -> PersonaProfile | None:
    chunks = embeddings.scroll_all_chunks(twin_id)
    if not chunks:
        return None

    by_video: dict[str, dict] = defaultdict(lambda: {"title": "", "segments": []})
    for c in chunks:
        vid = str(c.get("video_id") or "unknown")
        entry = by_video[vid]
        entry["title"] = entry["title"] or str(c.get("video_title") or vid)
        entry["segments"].append(
            TranscriptSegment(start_seconds=int(c.get("timestamp_seconds") or 0), text=str(c["text"]))
        )

    transcripts = [
        VideoTranscript(
            video_id=vid,
            title=v["title"],
            source="recovered",
            segments=sorted(v["segments"], key=lambda s: s.start_seconds),
        )
        for vid, v in by_video.items()
    ]

    persona = extract_persona(twin_id, creator_name or "the creator", transcripts)
    store.set_persona(persona)
    if store.get_status(twin_id) is None:
        store.set_status(IngestStatus(
            twin_id=twin_id, stage="ready", percent=100,
            videos_processed=len(transcripts), videos_total=len(transcripts),
            detail=f"Restored from {len(chunks)} indexed transcript chunks across {len(transcripts)} videos.",
        ))
    logger.info("recovered persona for %s from %d chunks", twin_id, len(chunks))
    return persona


def get_or_recover_persona(twin_id: str, creator_name: str | None = None) -> PersonaProfile | None:
    persona = store.get_persona(twin_id)
    if persona is not None:
        # Older records may carry a placeholder name — upgrade it when the
        # real one is known.
        if creator_name and persona.creator_name == "the creator":
            persona.creator_name = creator_name
            store.set_persona(persona)
        return persona
    try:
        return _rebuild(twin_id, creator_name)
    except Exception:
        logger.exception("persona recovery failed for %s", twin_id)
        return None


def get_or_recover_status(twin_id: str, creator_name: str | None = None) -> IngestStatus | None:
    status = store.get_status(twin_id)
    if status is not None:
        return status
    if get_or_recover_persona(twin_id, creator_name) is not None:
        return store.get_status(twin_id)
    return None
