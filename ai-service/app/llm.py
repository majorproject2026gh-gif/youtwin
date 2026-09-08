"""
Thin adapter so M4 can call either:
  - Ollama, running llama3 fully locally and free
  - Groq's free-tier hosted API serving the actual Llama-3-70B model
      named in the spec sheet

Flip providers with LLM_PROVIDER in .env — nothing else in the RAG
module needs to change.
"""
from __future__ import annotations

from .config import settings


def generate(system_prompt: str, user_prompt: str) -> str:
    if settings.llm_provider == "groq":
        return _generate_groq(system_prompt, user_prompt)
    return _generate_ollama(system_prompt, user_prompt)


def _generate_ollama(system_prompt: str, user_prompt: str) -> str:
    import ollama

    client = ollama.Client(host=settings.ollama_host)
    resp = client.chat(
        model=settings.ollama_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return resp["message"]["content"]


def _generate_groq(system_prompt: str, user_prompt: str) -> str:
    from groq import Groq

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY not set but LLM_PROVIDER=groq")

    client = Groq(api_key=settings.groq_api_key)
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return resp.choices[0].message.content
