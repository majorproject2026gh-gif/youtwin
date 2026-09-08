from __future__ import annotations

import logging
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import embeddings, ingestion, rag, store, video_gen
from .schemas import (
    ChatRequest, ChatResponse, IngestRequest, IngestStatus, PersonaProfile,
    VideoGenRequest, VideoGenStatus,
)
from .stylometry import extract_persona

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("youtwin")

app = FastAPI(title="YouTwin AI Service", version="1.0.0")

# Internal service — the Node api-service is the only intended caller,
# but CORS is left open for local dev convenience.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        transcripts = ingestion.ingest(
            channel_id=req.channel_id,
            video_urls=req.video_urls,
            use_sample_data=req.use_sample_data,
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

        chunk_count = embeddings.embed_and_index(twin_id, transcripts)

        store.set_status(IngestStatus(
            twin_id=twin_id, stage="ready", percent=100,
            videos_processed=total, videos_total=total,
            detail=f"Indexed {chunk_count} transcript chunks from {total} videos.",
        ))
    except Exception as exc:
        logger.exception("ingestion failed for %s", twin_id)
        store.set_status(IngestStatus(
            twin_id=twin_id, stage="error", percent=0, detail=str(exc),
        ))


@app.post("/ingest")
def start_ingest(req: IngestRequest, creator_name: str, background_tasks: BackgroundTasks):
    store.set_status(IngestStatus(twin_id=req.twin_id, stage="queued", percent=0))
    background_tasks.add_task(_run_ingestion_pipeline, req, creator_name)
    return {"twin_id": req.twin_id, "status": "queued"}


@app.get("/ingest/status/{twin_id}", response_model=IngestStatus)
def get_ingest_status(twin_id: str):
    status = store.get_status(twin_id)
    if status is None:
        raise HTTPException(404, "No ingestion found for this twin_id")
    return status


@app.get("/persona/{twin_id}", response_model=PersonaProfile)
def get_persona(twin_id: str):
    persona = store.get_persona(twin_id)
    if persona is None:
        raise HTTPException(404, "Persona not ready yet")
    return persona


@app.patch("/persona/{twin_id}", response_model=PersonaProfile)
def update_persona_toggles(twin_id: str, tone_match_enabled: bool, guardrails_enabled: bool):
    """Backs the 'Review persona' screen's Tone match / Guardrails toggles."""
    persona = store.get_persona(twin_id)
    if persona is None:
        raise HTTPException(404, "Persona not ready yet")
    persona.tone_match_enabled = tone_match_enabled
    persona.guardrails_enabled = guardrails_enabled
    store.set_persona(persona)
    return persona


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    persona = store.get_persona(req.twin_id)
    if persona is None:
        raise HTTPException(404, "This twin hasn't finished training yet")
    return rag.answer_query(req.twin_id, persona, req.message, req.language)


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
