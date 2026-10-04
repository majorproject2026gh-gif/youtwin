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
    # Lines in the creator's own voice, picked by the LlamaIndex step in
    # persona_file.py. Empty for personas built before it existed.
    style_exemplars: list[str] = Field(default_factory=list)
    guardrails_enabled: bool = True
    tone_match_enabled: bool = True


class ChatTurn(BaseModel):
    role: Literal["viewer", "twin"]
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    twin_id: str
    message: str
    conversation_id: Optional[str] = None
    language: str = "English"
    # Lets a twin whose persona record was lost be rebuilt with the right
    # name (see recovery.py). Optional — older callers still work.
    creator_name: Optional[str] = None
    # Playtime context: the video the viewer is watching and where they
    # are in it (from the browser sidebar or a ?v=&t= deep link). Both
    # optional; answers are then biased toward that part of that video.
    video_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{11}$")
    at_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    # The last few turns of this viewer's conversation, so follow-ups
    # ("how much was it?") are understood. Optional.
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)
    # The name the viewer gave on the share link's name step (greetings).
    viewer_name: Optional[str] = Field(default=None, max_length=40)


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


class PurgeRequest(BaseModel):
    twin_ids: list[str] = Field(min_length=1, max_length=500)


class VideoGenRequest(BaseModel):
    prompt: str


class VideoGenStatus(BaseModel):
    job_id: str
    prompt: str
    status: Literal["starting", "processing", "succeeded", "failed"]
    video_url: Optional[str] = None
    error: Optional[str] = None
