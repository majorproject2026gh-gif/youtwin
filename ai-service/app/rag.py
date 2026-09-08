"""
M4 - RAG-based Inference Module
LangChain-style orchestration · Llama-3-70B (via llm.py adapter)

Searches the twin's vector memory (M3) for grounded context, rejects
any query lacking strong factual correlation to prevent hallucination
(the "zero-hallucination" guardrail from the abstract), and otherwise
generates a persona-voiced, citation-backed answer.

Repeated identical questions for the same twin are served from a Redis
cache (see store.py) instead of re-running embedding search + an LLM
call every time — this is what keeps a popular twin responsive when
many viewers ask the same common questions concurrently.
"""
from __future__ import annotations

import hashlib

from . import embeddings, llm, store
from .config import settings
from .schemas import ChatResponse, Citation, PersonaProfile
from .stylometry import build_system_prompt


REFUSAL_REASON = (
    "No video segment in the creator's library was similar enough to "
    "confidently answer this — refusing rather than guessing."
)


def _cache_key(query: str, language: str = "English") -> str:
    return hashlib.sha256(f"{language}::{query.strip().lower()}".encode()).hexdigest()[:24]


def answer_query(twin_id: str, persona: PersonaProfile, query: str, language: str = "English") -> ChatResponse:
    cache_key = _cache_key(query, language)
    cached = store.get_cached_answer(twin_id, cache_key)
    if cached:
        return ChatResponse.model_validate_json(cached)

    response = _answer_query_uncached(twin_id, persona, query, language)

    if response.grounded:
        store.set_cached_answer(twin_id, cache_key, response.model_dump_json())

    return response


def _answer_query_uncached(twin_id: str, persona: PersonaProfile, query: str, language: str = "English") -> ChatResponse:
    hits = embeddings.search(twin_id, query, top_k=5)

    if not hits:
        return ChatResponse(
            twin_id=twin_id, answer="", grounded=False, confidence=0.0,
            refused=True, refusal_reason="This twin hasn't finished training yet.",
        )

    top_score = hits[0]["score"]
    confidence = float(top_score)

    if persona.guardrails_enabled and confidence < settings.rag_min_confidence:
        return ChatResponse(
            twin_id=twin_id, answer="", grounded=False, confidence=confidence,
            refused=True, refusal_reason=REFUSAL_REASON,
        )

    context_block = "\n\n".join(
        f"[Video: {h['video_title']} @ {h['timestamp_seconds']}s]\n{h['text']}"
        for h in hits
    )

    system_prompt = build_system_prompt(persona) if persona.tone_match_enabled else (
        f"You are {persona.creator_name}'s AI assistant. Only answer using the "
        "provided context. If unsure, say you don't know."
    )
    if language != "English":
        # Translation happens through the same Groq call already in use —
        # no new API or dependency, just an extra instruction. The
        # grounding constraint stays in force regardless of language.
        system_prompt += (
            f" Respond ONLY in {language}, even though the source context is in English. "
            "Translate naturally — don't just answer in English and note the language."
        )

    user_prompt = (
        f"Context from the creator's videos:\n{context_block}\n\n"
        f"Viewer question: {query}\n\n"
        "Answer in 1-3 sentences, grounded strictly in the context above."
    )

    answer_text = llm.generate(system_prompt, user_prompt)

    citations = [
        Citation(
            video_id=h["video_id"],
            video_title=h["video_title"],
            timestamp_seconds=h["timestamp_seconds"],
            snippet=h["text"][:180],
        )
        for h in hits[:2]
    ]

    return ChatResponse(
        twin_id=twin_id,
        answer=answer_text.strip(),
        grounded=True,
        confidence=confidence,
        citations=citations,
        refused=False,
    )
