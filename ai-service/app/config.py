from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Vector DB
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""

    # LLM
    llm_provider: str = "ollama"  # "ollama" | "groq"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # Video generation (agent) — Replicate
    replicate_api_token: str = ""
    replicate_model_version: str = ""

    # YouTube
    youtube_api_key: str = ""

    # Whisper
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"

    # Guardrail
    rag_min_confidence: float = 0.55

    # Redis (Upstash) - durable, multi-worker-safe status/persona/cache store
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
