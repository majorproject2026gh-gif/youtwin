"""
AI Video Generation Module (Agent)
Text-to-video via Replicate's API — a creator types a prompt, this
generates a short video clip, which the frontend can then upload
directly to the creator's YouTube channel with one click.

Uses Replicate because it's the most realistically accessible
text-to-video option: a simple REST API, no waitlist, pay-per-use with
free trial credit — unlike Runway/Pika/Sora which require special
access. Output is real but modest: open text-to-video models produce
short (~3-4s), moderate-quality clips, not cinematic-grade video.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from .config import settings

logger = logging.getLogger("youtwin.video_gen")

REPLICATE_API_BASE = "https://api.replicate.com/v1"

# Verified working version hash + matching input schema (confirmed via
# Replicate's own model page) — the previous version hash was stale/
# incorrect, and the request was also missing several fields the model
# actually requires beyond just "prompt", which is what caused the 422.
DEFAULT_MODEL_VERSION = (
    "anotherjesse/zeroscope-v2-xl:"
    "dcad8a883c2e99e3bf1d88590ce070bc6dd4e498af14a3f2f6e437f0f1ba7adb"
)


@dataclass
class VideoGenResult:
    status: str  # "starting" | "processing" | "succeeded" | "failed"
    video_url: str | None = None
    error: str | None = None


def _headers() -> dict:
    if not settings.replicate_api_token:
        raise RuntimeError(
            "REPLICATE_API_TOKEN not set — sign up free at replicate.com, "
            "create an API token, and add it to ai-service/.env"
        )
    return {
        "Authorization": f"Bearer {settings.replicate_api_token}",
        "Content-Type": "application/json",
    }


def _raise_with_detail(resp: httpx.Response) -> None:
    """httpx's raise_for_status() alone discards the response body, which
    is exactly where Replicate puts the actually useful validation error
    (e.g. which field was wrong) — surface that instead of a bare 422."""
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except Exception:
            detail = resp.text
        raise RuntimeError(f"Replicate API error ({resp.status_code}): {detail}")


def start_generation(prompt: str) -> str:
    """Kicks off a video generation job on Replicate. Returns the
    prediction id used to poll for the result."""
    model_version = settings.replicate_model_version or DEFAULT_MODEL_VERSION
    payload = {
        "version": model_version.split(":")[-1],
        "input": {
            "prompt": prompt,
            "negative_prompt": "",
            "num_frames": 24,
            "num_inference_steps": 50,
            "width": 576,
            "height": 320,
            "guidance_scale": 7.5,
            "fps": 8,
            "model": "xl",
            "batch_size": 1,
            "init_weight": 0.5,
            "remove_watermark": False,
        },
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(f"{REPLICATE_API_BASE}/predictions", headers=_headers(), json=payload)
        _raise_with_detail(resp)
        data = resp.json()
        return data["id"]


def check_generation(prediction_id: str) -> VideoGenResult:
    """Polls Replicate for the current state of a generation job."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(f"{REPLICATE_API_BASE}/predictions/{prediction_id}", headers=_headers())
        _raise_with_detail(resp)
        data = resp.json()

    status = data.get("status", "processing")
    if status == "succeeded":
        output = data.get("output")
        # Zeroscope-style models return either a single URL or a list of frame/video URLs
        video_url = output if isinstance(output, str) else (output[-1] if output else None)
        return VideoGenResult(status="succeeded", video_url=video_url)
    if status == "failed" or status == "canceled":
        return VideoGenResult(status="failed", error=data.get("error") or "Generation failed")
    return VideoGenResult(status=status)


def generate_video_sync(prompt: str, timeout_seconds: int = 180, poll_interval: float = 3.0) -> VideoGenResult:
    """Convenience wrapper: starts a job and blocks (with polling) until
    it finishes or times out. Used by the background task in main.py so
    the HTTP request returns immediately while this runs."""
    prediction_id = start_generation(prompt)
    elapsed = 0.0
    while elapsed < timeout_seconds:
        result = check_generation(prediction_id)
        if result.status in ("succeeded", "failed"):
            return result
        time.sleep(poll_interval)
        elapsed += poll_interval
    return VideoGenResult(status="failed", error="Generation timed out")
