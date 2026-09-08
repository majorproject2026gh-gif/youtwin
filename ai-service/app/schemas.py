from pydantic import BaseModel, Field
from typing import Optional, Literal


class IngestRequest(BaseModel):
    twin_id: str
    channel_id: Optional[str] = None
    video_urls: Optional[list[str]] = None
    use_sample_data: bool = False


class IngestStatus(BaseModel):
    twin_id: str
    stage: Literal["queued", "fetching_captions", "transcribing_audio",
                    "extracting_style", "embedding", "ready", "error"]
    percent: int
    videos_processed: int = 0
    videos_total: int = 0
    detail: str = ""


class PersonaProfile(BaseModel):
    twin_id: str
    creator_name: str
    tone_descriptors: list[str] = Field(default_factory=list)
    avg_sentence_length: float = 0.0
    speaking_pace_wpm: float = 0.0
    top_vocabulary: list[str] = Field(default_factory=list)
    catchphrases: list[str] = Field(default_factory=list)
    sample_opening_line: str = ""
    guardrails_enabled: bool = True
    tone_match_enabled: bool = True


class ChatRequest(BaseModel):
    twin_id: str
    message: str
    conversation_id: Optional[str] = None
    language: str = "English"


class Citation(BaseModel):
    video_id: str
    video_title: str
    timestamp_seconds: int
    snippet: str


class ChatResponse(BaseModel):
    twin_id: str
    answer: str
    grounded: bool
    confidence: float
    citations: list[Citation] = Field(default_factory=list)
    refused: bool = False
    refusal_reason: Optional[str] = None


class VideoGenRequest(BaseModel):
    prompt: str


class VideoGenStatus(BaseModel):
    job_id: str
    prompt: str
    status: Literal["starting", "processing", "succeeded", "failed"]
    video_url: Optional[str] = None
    error: Optional[str] = None
