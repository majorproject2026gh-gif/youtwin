from __future__ import annotations

import hmac
import re
import logging
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from . import embeddings, ingestion, rag, store, video_gen
from .recovery import get_or_recover_persona, get_or_recover_status
from .config import settings
from .schemas import (
    PurgeRequest,
    ChatRequest, ChatResponse, IngestRequest, IngestStatus, PersonaProfile,
    VideoGenRequest, VideoGenStatus,
)
from .persona_file import build_definition
from .stylometry import extract_persona

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("youtwin")

app = FastAPI(title="YouTwin AI Service", version="1.0.0")

# Internal service — the Node api-service (server-to-server) is the only
# caller, so no CORS headers are sent: browsers on other sites can't read
# its responses. (This used to allow every origin.)

# Once this service is deployed publicly (see DEPLOYMENT.md), it's no
# longer implicitly protected by being unreachable outside localhost.
# If AI_SERVICE_SECRET is set, every request except /health must present
# it — this is how api-service proves a request is genuinely from it,
# not from anyone who's found this service's public URL.
#
# Read through `settings` (config.py), NOT os.environ directly. This
# used to be os.environ.get("AI_SERVICE_SECRET") — but nothing in this
# service ever calls load_dotenv(), so that only ever saw a REAL
# exported OS environment variable, never a value that only lives in
# .env (the normal way to set it locally). That silently disabled this
# check for the entire local-dev workflow tonight, while it would
# suddenly start being enforced once deployed somewhere (Render) that
# injects real env vars — two different behaviors from the same code.
# `settings` already loads AI_SERVICE_SECRET correctly from either
# source, so this is now consistent everywhere.
_TWIN_ID_RE = re.compile(r"^[0-9a-fA-F-]{8,64}$")
_INTERNAL_SECRET = settings.ai_service_secret
if not _INTERNAL_SECRET:
    logger.warning(
        "AI_SERVICE_SECRET is not set: every endpoint is open to anyone who can reach "
        "this service. Set it (same value as api-service) before deploying publicly."
    )


@app.middleware("http")
async def verify_internal_secret(request: Request, call_next):
    if _INTERNAL_SECRET and request.url.path != "/health":
        provided = request.headers.get("x-internal-secret") or ""
        if not hmac.compare_digest(provided, _INTERNAL_SECRET):
            # Must RETURN a response here: an HTTPException raised inside
            # an http middleware bypasses FastAPI's exception handlers and
            # surfaces as a 500 + stack trace instead of a clean 401.
            return JSONResponse({"detail": "Missing or invalid internal secret"}, status_code=401)
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok"}


def _run_ingestion_pipeline(req: IngestRequest, creator_name: str) -> None:
    """Runs M1 -> M2 -> M3 in the background and updates status as it goes,
    matching the "68% transcribing & indexing" progress ring in the
    creator dashboard journey map."""
    twin_id = req.twin_id
    try:
        store.set_status(IngestStatus(twin_id=twin_id, stage="fetching_captions", percent=5))

        def on_progress(done: int, total: int, stage: str) -> None:
            # Real per-video progress (5% → 35%) instead of a single jump,
            # including the "transcribing_audio" stage when Whisper runs.
            store.set_status(IngestStatus(
                twin_id=twin_id,
                stage=stage if stage in ("fetching_captions", "transcribing_audio") else "fetching_captions",
                percent=5 + int(30 * done / max(total, 1)),
                videos_processed=done, videos_total=total,
            ))

        transcripts = ingestion.ingest(
            channel_id=req.channel_id,
            video_urls=req.video_urls,
            use_sample_data=req.use_sample_data,
            on_progress=on_progress,
        )
        total = len(transcripts)
        store.set_status(IngestStatus(
            twin_id=twin_id, stage="extracting_style", percent=40,
            videos_processed=total, videos_total=total,
        ))

        persona = extract_persona(twin_id, creator_name, transcripts)
        store.set_persona(persona)

        store.set_status(IngestStatus(
            twin_id=twin_id, stage="embedding", percent=70,
            videos_processed=total, videos_total=total,
        ))

        if store.is_deleted(twin_id):
            logger.info("twin %s was deleted during ingestion; stopping", twin_id)
            store.delete_twin_data(twin_id)
            return

        chunk_count = embeddings.embed_and_index(twin_id, transcripts)

        if store.is_deleted(twin_id):
            embeddings.delete_collection(twin_id)
            store.delete_twin_data(twin_id)
            return

        store.set_status(IngestStatus(
            twin_id=twin_id, stage="ready", percent=100,
            videos_processed=total, videos_total=total,
            detail=f"Indexed {chunk_count} transcript chunks from {total} videos.",
        ))
    except Exception as exc:
        logger.exception("ingestion failed for %s", twin_id)
        if store.is_deleted(twin_id):
            store.delete_twin_data(twin_id)
            return
        store.set_status(IngestStatus(
            twin_id=twin_id, stage="error", percent=0, detail=str(exc),
        ))


@app.post("/ingest")
def start_ingest(req: IngestRequest, creator_name: str, background_tasks: BackgroundTasks):
    store.set_status(IngestStatus(twin_id=req.twin_id, stage="queued", percent=0))
    background_tasks.add_task(_run_ingestion_pipeline, req, creator_name)
    return {"twin_id": req.twin_id, "status": "queued"}


@app.post("/twins/purge")
def purge_twins(req: PurgeRequest):
    """Permanently removes everything the AI service holds for these twins:
    the Qdrant vector collection, ingest status, persona and cached
    answers. Called by api-service after it deletes the twins' database
    rows. Idempotent: already-missing data is simply skipped."""
    purged, failed = [], []
    for twin_id in dict.fromkeys(req.twin_ids):
        if not _TWIN_ID_RE.match(twin_id):
            failed.append(twin_id)
            continue
        try:
            store.mark_deleted(twin_id)
            embeddings.delete_collection(twin_id)
            store.delete_twin_data(twin_id)
            purged.append(twin_id)
        except Exception:
            logger.exception("purge failed for %s", twin_id)
            failed.append(twin_id)
    return {"purged": len(purged), "failed": failed}


@app.get("/ingest/status/{twin_id}", response_model=IngestStatus)
def get_ingest_status(twin_id: str, creator_name: str | None = None):
    status = get_or_recover_status(twin_id, creator_name)
    if status is None:
        raise HTTPException(404, "No ingestion found for this twin_id")
    return status


@app.get("/persona/{twin_id}", response_model=PersonaProfile)
def get_persona(twin_id: str, creator_name: str | None = None):
    persona = get_or_recover_persona(twin_id, creator_name)
    if persona is None:
        raise HTTPException(404, "Persona not ready yet")
    return persona


@app.get("/persona/{twin_id}/definition")
def get_persona_definition(twin_id: str, creator_name: str | None = None):
    """The M2 persona definition file (spaCy profile + LlamaIndex
    Document), downloadable from the creator's Review screen."""
    persona = get_or_recover_persona(twin_id, creator_name)
    if persona is None:
        raise HTTPException(404, "Persona not ready yet")
    return build_definition(persona)


@app.patch("/persona/{twin_id}", response_model=PersonaProfile)
def update_persona_toggles(twin_id: str, tone_match_enabled: bool, guardrails_enabled: bool):
    """Backs the 'Review persona' screen's Tone match / Guardrails toggles."""
    persona = get_or_recover_persona(twin_id)
    if persona is None:
        raise HTTPException(404, "Persona not ready yet")
    persona.tone_match_enabled = tone_match_enabled
    persona.guardrails_enabled = guardrails_enabled
    store.set_persona(persona)
    return persona


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    persona = get_or_recover_persona(req.twin_id, req.creator_name)
    if persona is None:
        raise HTTPException(404, "This twin hasn't finished training yet")
    return rag.answer_query(
        req.twin_id, persona, req.message, req.language,
        video_id=req.video_id, at_seconds=req.at_seconds,
        history=[t.model_dump() for t in req.history],
        viewer_name=req.viewer_name,
    )


def _run_video_generation(job_id: str, prompt: str) -> None:
    """Background task: calls Replicate, updates job status as it goes.
    Mirrors the same background-task + polling pattern already used for
    ingestion (see _run_ingestion_pipeline above), for consistency."""
    try:
        result = video_gen.generate_video_sync(prompt)
        store.set_video_job(VideoGenStatus(
            job_id=job_id, prompt=prompt, status=result.status,
            video_url=result.video_url, error=result.error,
        ))
    except Exception as exc:
        logger.exception("video generation failed for %s", job_id)
        store.set_video_job(VideoGenStatus(
            job_id=job_id, prompt=prompt, status="failed", error=str(exc),
        ))


@app.post("/video/generate", response_model=VideoGenStatus)
def start_video_generation(req: VideoGenRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job = VideoGenStatus(job_id=job_id, prompt=req.prompt, status="starting")
    store.set_video_job(job)
    background_tasks.add_task(_run_video_generation, job_id, req.prompt)
    return job


@app.get("/video/status/{job_id}", response_model=VideoGenStatus)
def get_video_generation_status(job_id: str):
    job = store.get_video_job(job_id)
    if job is None:
        raise HTTPException(404, "No video generation job found for this id")
    return job


@app.get("/moments/{twin_id}")
def get_moments(twin_id: str):
    """Backs the Topic Explorer — a browsable set of moments from the
    creator's videos, reusing the same Qdrant collection RAG search
    already relies on."""
    return {"moments": embeddings.browse_moments(twin_id)}
