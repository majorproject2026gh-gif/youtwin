"""
Thin adapter so M4 can call any of:
  - Ollama, running Llama 3 fully locally and free
    (OLLAMA_MODEL=llama3:70b for the Llama-3-70B in the spec sheet)
  - an OpenAI-compatible server hosting Llama-3-70B (vLLM on the AWS
    EC2 g5 node from the spec sheet, Together, OpenRouter, Fireworks...)
  - Groq's free-tier hosted API

Flip providers with LLM_PROVIDER in .env — nothing else in the RAG
module needs to change. The LangChain chain in rag.py wraps generate()
as its model step.
"""
from __future__ import annotations

import httpx

from .config import settings


def model_label() -> str:
    """Which model is actually answering — surfaced in /health."""
    if settings.llm_provider == "groq":
        return f"groq:{settings.groq_model}"
    if settings.llm_provider == "openai_compat":
        return f"openai_compat:{settings.openai_compat_model}"
    return f"ollama:{settings.ollama_model}"


# Low temperature: answers should restate the creator's words, not riff.
DEFAULT_TEMPERATURE = 0.2


def generate(system_prompt: str, user_prompt: str, *, max_tokens: int | None = None,
             temperature: float = DEFAULT_TEMPERATURE) -> str:
    limit = max_tokens or settings.llm_max_tokens
    if settings.llm_provider == "groq":
        return _generate_groq(system_prompt, user_prompt, limit, temperature)
    if settings.llm_provider == "openai_compat":
        return _generate_openai_compat(system_prompt, user_prompt, limit, temperature)
    return _generate_ollama(system_prompt, user_prompt, limit, temperature)


def _is_reasoning_model(model: str) -> bool:
    # gpt-oss / o-series / qwen3 / deepseek-r1 think before answering, and
    # those hidden tokens count against max_tokens.
    m = model.lower()
    return any(k in m for k in ("gpt-oss", "/o1", "/o3", "o4-mini", "qwen3", "deepseek-r1"))


def _messages(system_prompt: str, user_prompt: str) -> list[dict]:
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _generate_ollama(system_prompt: str, user_prompt: str, limit: int, temperature: float) -> str:
    import ollama

    client = ollama.Client(host=settings.ollama_host, timeout=settings.llm_timeout_seconds)
    resp = client.chat(model=settings.ollama_model, messages=_messages(system_prompt, user_prompt),
                       options={"num_predict": limit, "temperature": temperature})
    return (resp.get("message") or {}).get("content") or ""


def _generate_openai_compat(system_prompt: str, user_prompt: str, limit: int, temperature: float) -> str:
    base = settings.openai_compat_base_url.rstrip("/")
    if not base:
        raise RuntimeError("OPENAI_COMPAT_BASE_URL not set but LLM_PROVIDER=openai_compat")
    headers = {"Content-Type": "application/json"}
    if settings.openai_compat_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_compat_api_key}"
    resp = httpx.post(
        f"{base}/chat/completions",
        headers=headers,
        json={
            "model": settings.openai_compat_model,
            "messages": _messages(system_prompt, user_prompt),
            "temperature": temperature,
            "max_tokens": limit,
        },
        timeout=settings.llm_timeout_seconds,
    )
    resp.raise_for_status()
    choices = resp.json().get("choices") or []
    return ((choices[0].get("message") or {}).get("content") if choices else "") or ""


def _generate_groq(system_prompt: str, user_prompt: str, limit: int, temperature: float) -> str:
    from groq import Groq

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY not set but LLM_PROVIDER=groq")

    client = Groq(api_key=settings.groq_api_key, timeout=settings.llm_timeout_seconds)
    extra = {}
    if _is_reasoning_model(settings.groq_model):
        # Short, factual answers don't need long hidden reasoning — and
        # with the default effort the reasoning alone could use up the
        # whole token budget and leave an empty answer.
        extra = {"reasoning_effort": "low"}
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=_messages(system_prompt, user_prompt),
        max_tokens=limit,
        temperature=temperature,
        extra_body=extra or None,
    )
    # content can be None (e.g. a filtered/empty completion) — never let
    # that crash the chat endpoint with an AttributeError on .strip().
    return (resp.choices[0].message.content if resp.choices else "") or ""
