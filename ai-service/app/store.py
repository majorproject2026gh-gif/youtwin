"""
Durable, multi-worker-safe store for ingest status and persona profiles,
backed by Upstash Redis (serverless, HTTP-based — same free-tier pattern
as Qdrant Cloud).

This replaces the earlier in-memory Python dict version, which broke as
soon as you ran more than one server process (impossible to scale
horizontally) or restarted the service (all state lost). Redis keys
expire automatically after 24h so completed/abandoned twins don't
accumulate forever on the free tier.

Falls back to an in-memory dict automatically if Upstash isn't
configured, so local development without Redis still works — but this
fallback is NOT safe for production/multi-worker use.
"""
from __future__ import annotations

import logging

from .config import settings
from .schemas import IngestStatus, PersonaProfile, VideoGenStatus

logger = logging.getLogger("youtwin.store")

TTL_SECONDS = 60 * 60 * 24  # 24h — only for in-progress ingest status

# Personas and FINISHED ingest statuses are kept with no expiry. They used
# to expire after 24h too — which silently broke every public share link a
# day after training (the chat endpoint 404s without a persona, so the
# twin looked "not trained" even though its vectors were still in Qdrant).

_redis = None
_use_redis = bool(settings.upstash_redis_url and settings.upstash_redis_token)

if _use_redis:
    try:
        from upstash_redis import Redis
        _redis = Redis(url=settings.upstash_redis_url, token=settings.upstash_redis_token)
        logger.info("store: using Upstash Redis")
    except Exception as exc:
        logger.warning("store: failed to init Upstash Redis (%s), falling back to in-memory", exc)
        _use_redis = False

# in-memory fallback (single-process/dev only)
_status_mem: dict[str, IngestStatus] = {}
_persona_mem: dict[str, PersonaProfile] = {}


def set_status(status: IngestStatus) -> None:
    if _use_redis:
        if status.stage in ("ready", "error"):
            _redis.set(f"status:{status.twin_id}", status.model_dump_json())
        else:
            _redis.set(f"status:{status.twin_id}", status.model_dump_json(), ex=TTL_SECONDS)
    else:
        _status_mem[status.twin_id] = status


def get_status(twin_id: str) -> IngestStatus | None:
    if _use_redis:
        raw = _redis.get(f"status:{twin_id}")
        return IngestStatus.model_validate_json(raw) if raw else None
    return _status_mem.get(twin_id)


def set_persona(persona: PersonaProfile) -> None:
    if _use_redis:
        _redis.set(f"persona:{persona.twin_id}", persona.model_dump_json())
    else:
        _persona_mem[persona.twin_id] = persona


def get_persona(twin_id: str) -> PersonaProfile | None:
    if _use_redis:
        raw = _redis.get(f"persona:{twin_id}")
        return PersonaProfile.model_validate_json(raw) if raw else None
    return _persona_mem.get(twin_id)


# --- Response cache for repeated identical questions (helps under load) ---

CACHE_TTL_SECONDS = 60 * 30  # 30 min


def get_cached_answer(twin_id: str, question_key: str) -> str | None:
    if not _use_redis:
        return None
    return _redis.get(f"cache:{twin_id}:{question_key}")


def set_cached_answer(twin_id: str, question_key: str, answer_json: str) -> None:
    if not _use_redis:
        return
    _redis.set(f"cache:{twin_id}:{question_key}", answer_json, ex=CACHE_TTL_SECONDS)


# --- Video generation job status (agent feature) ---

_video_job_mem: dict[str, VideoGenStatus] = {}
VIDEO_JOB_TTL_SECONDS = 60 * 60  # 1h — generation jobs are short-lived


def set_video_job(job: VideoGenStatus) -> None:
    if _use_redis:
        _redis.set(f"video:{job.job_id}", job.model_dump_json(), ex=VIDEO_JOB_TTL_SECONDS)
    else:
        _video_job_mem[job.job_id] = job


def get_video_job(job_id: str) -> VideoGenStatus | None:
    if _use_redis:
        raw = _redis.get(f"video:{job_id}")
        return VideoGenStatus.model_validate_json(raw) if raw else None
    return _video_job_mem.get(job_id)


# --- Deleting a twin -------------------------------------------------------

DELETED_TTL_SECONDS = 60 * 60 * 24  # tombstone outlives any running ingest
_deleted_mem: set[str] = set()


def mark_deleted(twin_id: str) -> None:
    """Tombstone, so an ingest still running in the background for this twin
    stops instead of writing its data back after the twin was deleted."""
    if _use_redis:
        _redis.set(f"deleted:{twin_id}", "1", ex=DELETED_TTL_SECONDS)
    else:
        _deleted_mem.add(twin_id)


def is_deleted(twin_id: str) -> bool:
    if _use_redis:
        return bool(_redis.get(f"deleted:{twin_id}"))
    return twin_id in _deleted_mem


def delete_twin_data(twin_id: str) -> int:
    """Removes the twin's status, persona and cached answers. Returns the
    number of keys removed."""
    if not _use_redis:
        removed = int(_status_mem.pop(twin_id, None) is not None) + int(_persona_mem.pop(twin_id, None) is not None)
        return removed
    keys = [f"status:{twin_id}", f"persona:{twin_id}"]
    cursor = 0
    while True:
        cursor, batch = _redis.scan(cursor, match=f"cache:{twin_id}:*", count=200)
        keys.extend(batch)
        if not cursor or int(cursor) == 0:
            break
    return int(_redis.delete(*keys) or 0)
