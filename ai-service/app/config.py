from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Vector DB
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""

    # LLM
    # "ollama" | "groq" | "openai_compat"
    #   ollama         - local Llama 3 (set OLLAMA_MODEL=llama3:70b on a
    #                    GPU box that can hold the 70B weights)
    #   groq           - hosted, free tier. Groq retired Llama-3.3-70B from
    #                    its free plan in Aug 2026, so the default here is
    #                    the model that still works there.
    #   openai_compat  - any OpenAI-compatible server hosting Llama-3-70B:
    #                    vLLM on the AWS EC2 g5 node from the spec sheet,
    #                    Together, OpenRouter, Fireworks, etc.
    llm_provider: str = "ollama"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    openai_compat_base_url: str = ""
    openai_compat_api_key: str = ""
    openai_compat_model: str = "meta-llama/Meta-Llama-3-70B-Instruct"
    llm_timeout_seconds: float = 40.0
    # Hard cap on tokens per LLM call (cost / abuse limit). Reasoning
    # models (the gpt-oss default) spend part of it thinking, so this is
    # set above the ~150 tokens a 1-3 sentence answer needs.
    llm_max_tokens: int = 700

    # Video generation (agent) — Replicate
    replicate_api_token: str = ""
    replicate_model_version: str = ""

    # YouTube
    youtube_api_key: str = ""

    # Whisper
    # "auto" = Whisper large-v3 on a CUDA GPU (the spec's Whisper-v3),
    # "base" on CPU-only hosts where large-v3 (~3 GB) can't run in time.
    # Any explicit faster-whisper size ("large-v3", "small", ...) wins.
    whisper_model_size: str = "auto"
    whisper_device: str = "cpu"

    # Embeddings (M3). BGE-small: same size class as the original
    # all-MiniLM-L6-v2 (384-dim, CPU-friendly, fits a free 512 MB host)
    # but much better at matching viewer questions to transcript passages.
    # Changing this re-embeds each twin's index automatically on its next
    # question (see embeddings.py).
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Guardrail. A 0-1 confidence below which the twin refuses instead of
    # answering. Confidence is calibrated per embedding model (rag.py), so
    # 0.55 means the same thing whichever model is configured.
    rag_min_confidence: float = 0.55

    # Redis (Upstash) - durable, multi-worker-safe status/persona/cache store
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    # Internal auth — read directly via os.environ in main.py's middleware
    # (it needs to still work even if this Settings object failed to
    # build), but it must ALSO be declared here: pydantic-settings
    # validates every key in .env against this model and rejects any it
    # doesn't recognize with extra_forbidden, which crashed the whole
    # service on startup the moment AI_SERVICE_SECRET was added to .env
    # for deployment. Declaring it fixes that; `extra="ignore"` below is
    # a second layer so a future unrelated .env addition can't do this
    # again.
    ai_service_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()


def resolved_whisper_model() -> str:
    size = (settings.whisper_model_size or "auto").strip()
    if size != "auto":
        return size
    return "large-v3" if settings.whisper_device.startswith("cuda") else "base"

