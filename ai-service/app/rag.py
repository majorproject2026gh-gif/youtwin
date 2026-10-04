"""
M4 - RAG-based Inference Module
LangChain (LCEL) orchestration · Llama-3-70B (via llm.py adapter)

The pipeline is a LangChain runnable chain:

    retrieve  ->  guardrail branch  ->  prompt  ->  LLM  ->  parse  ->  package
    (Qdrant       (refuse below        (numbered     (llm.py) (citations,  (answer +
     hybrid)       threshold)           excerpts)              NOT_IN_       exact
                                                               CONTEXT)      moments)

Accuracy measures, in pipeline order:

1. Follow-up questions ("how much was it?") are rewritten into standalone
   questions using the viewer's last few turns before searching.
2. Retrieval is hybrid (meaning + keywords, embeddings.py) and, when the
   viewer's current video + playtime is known, ranks moments near the
   playhead higher. Ranking only — the guardrail never sees that bonus.
3. Guardrail 1 (before the LLM): refuse when the evidence — the best
   chunk's similarity plus the share of the question's words it contains,
   calibrated to 0-1 per embedding model — is below RAG_MIN_CONFIDENCE.
4. Guardrail 2 (the LLM): the excerpts are numbered; the model must cite
   the excerpt behind every fact and reply NOT_IN_CONTEXT when the
   excerpts don't answer the question. That catches on-topic questions
   the creator never answered ("best RTX 4090 deal?" on a PC-build
   channel), which similarity alone can't tell apart.
5. Citations are the excerpts the model actually cited, each pinned to
   the caption line that matches the answer, not the start of a chunk.

Repeated identical questions for the same twin are served from a Redis
cache (see store.py) instead of re-running search + an LLM call.

If langchain-core is unavailable the exact same step functions run in
sequence without it, so the service never breaks over the import.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any, Optional

import numpy as np

from . import embeddings, llm, store
from .config import settings
from .schemas import ChatResponse, Citation, PersonaProfile
from .stylometry import build_system_prompt

logger = logging.getLogger("youtwin.rag")

REFUSAL_REASON = (
    "No video segment in the creator's library was similar enough to "
    "confidently answer this — refusing rather than guessing."
)
NOT_COVERED_REASON = (
    "The creator's videos touch on this topic but don't actually answer "
    "that question — refusing rather than guessing."
)
NOT_TRAINED = "This twin hasn't finished training yet."
EMPTY_ANSWER = "I couldn't put an answer together for that just now — try asking again."
NOT_IN_CONTEXT = "NOT_IN_CONTEXT"

TOP_K = 5                 # excerpts given to the LLM
CANDIDATE_K = 8           # fused candidates considered before trimming
PLAYHEAD_WINDOW_S = 180   # moments within 3 min of the playhead get a boost
PLAYHEAD_BOOST = 0.15     # ranking bonus only; never used for the guardrail
MAX_CITATIONS = 3

# Evidence = cosine similarity + LEXICAL_WEIGHT x keyword overlap. On the
# evaluation set this separated answerable from off-topic questions far
# better than similarity alone (ROC AUC 0.94 -> 0.96).
LEXICAL_WEIGHT = 0.2

# Raw evidence -> 0-1 confidence. Each embedding model scores on its own
# scale (BGE similarities run much higher than MiniLM's), so anchors are
# per model, chosen so the default RAG_MIN_CONFIDENCE of 0.55 sits where
# ~97% of answerable questions pass and most off-topic ones are refused.
_CALIBRATION: dict[str, tuple[list[float], list[float]]] = {
    "bge": ([0.50, 0.66, 0.92, 1.2], [0.0, 0.55, 0.95, 1.0]),
    "minilm": ([0.20, 0.42, 0.75, 1.2], [0.0, 0.55, 0.95, 1.0]),
}


def calibrate(evidence: float) -> float:
    model = settings.embedding_model.lower()
    key = "bge" if "bge" in model else "minilm" if "minilm" in model else None
    if key is None:
        return float(min(max(evidence, 0.0), 1.0))
    xs, ys = _CALIBRATION[key]
    return round(float(np.interp(evidence, xs, ys)), 4)


def _evidence(hit: dict) -> float:
    return float(hit.get("score", 0.0)) + LEXICAL_WEIGHT * float(hit.get("lexical", 0.0))


def _fmt_ts(seconds: int) -> str:
    seconds = max(0, int(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _cache_key(query: str, language: str = "English", persona: PersonaProfile | None = None,
               video_id: Optional[str] = None, at_seconds: Optional[int] = None) -> str:
    # Include the persona toggles: flipping Tone match / Guardrails on the
    # Review screen must not keep serving answers cached under the old
    # settings. Playtime context is bucketed to 30 s so nearby viewers
    # still share cache entries. "v2" separates answers produced by the
    # current pipeline from older cached ones.
    flags = f"{int(persona.tone_match_enabled)}{int(persona.guardrails_enabled)}" if persona else ""
    ctx = f"{video_id}@{(at_seconds or 0) // 30}" if video_id else ""
    return hashlib.sha256(f"v2::{flags}::{ctx}::{language}::{query.strip().lower()}".encode()).hexdigest()[:24]


# ---------------------------------------------------------------- small talk

_GREETING_RE = re.compile(
    r"^(hi+|hey+|hello+|hlo|helo|yo|namaste|namaskar|good (morning|afternoon|evening)|sup|what'?s up)\b", re.I)
_THANKS_RE = re.compile(r"^(thanks?|thank (you|u)|thx|ty|dhanyavaad|shukriya)\b", re.I)
_BYE_RE = re.compile(r"^(bye+|good ?bye|see (you|ya)|cya)\b", re.I)
_HOW_ARE_YOU_RE = re.compile(r"how (are|r) (you|u)( doing)?|how'?s it going|kaise ho", re.I)


def _small_talk(query: str, persona: PersonaProfile, viewer_name: Optional[str] = None) -> Optional[str]:
    """A friendly reply to a bare greeting / thanks / goodbye, which used to
    go through retrieval and come back as a refusal. Anything with a real
    question after the greeting ("hey, which phone?") is answered normally."""
    q = query.strip().lower()
    hey = f"Hey {viewer_name}!" if viewer_name else "Hey!"
    if _HOW_ARE_YOU_RE.fullmatch(re.sub(r"^(hi+|hey+|hello+)[\s,!]*", "", q).strip(" ?!.")):
        return "Doing great, thanks for asking! What would you like to know about my videos?"
    for pattern, reply in (
        (_GREETING_RE, f"{hey} I'm this channel's YouTwin. Ask me anything about my videos "
                       "and I'll point you to the exact moment I talk about it."),
        (_THANKS_RE, "Happy to help! Ask me anything else about my videos."),
        (_BYE_RE, "Bye! Thanks for watching."),
    ):
        m = pattern.match(q)
        if m:
            rest = q[m.end():]
            if "?" not in rest and len(re.findall(r"[a-z']+", rest)) <= 2:
                return reply
            return None
    return None


# ---------------------------------------------------------------- follow-ups

_FOLLOW_UP_WORDS = {
    "it", "its", "that", "this", "those", "these", "they", "them", "their", "he", "she",
    "him", "her", "one", "ones", "there", "same", "more", "else", "also", "too", "again",
    "former", "latter", "above", "previous", "other", "another",
}


def _needs_context(query: str) -> bool:
    words = re.findall(r"[a-z']+", query.lower())
    return len(words) <= 5 or any(w in _FOLLOW_UP_WORDS for w in words) or (
        bool(words) and words[0] in {"and", "but", "so", "also", "why"})


def _condense(state: dict) -> dict:
    """Rewrites a follow-up into a standalone search query."""
    query = state["query"]
    history = [t for t in (state.get("history") or []) if t.get("content")][-4:]
    if not history or not _needs_context(query):
        return {**state, "search_query": query}
    convo = "\n".join(
        f"{'Viewer' if t.get('role') == 'viewer' else 'Creator'}: {str(t['content'])[:400]}" for t in history
    )
    try:
        out = llm.generate(
            "You turn a viewer's follow-up message into one standalone question that "
            "makes sense without the conversation. Keep names, products and numbers. "
            "Reply with the question only.",
            f"Conversation so far:\n{convo}\n\nFollow-up: {query}\n\nStandalone question:",
            max_tokens=300, temperature=0.0,
        )
        line = next((l.strip().strip('"') for l in (out or "").splitlines() if l.strip()), "")
        if 3 <= len(line) <= 300 and NOT_IN_CONTEXT not in line:
            return {**state, "search_query": line}
    except Exception as exc:
        logger.info("follow-up rewrite failed, using the raw question: %s", exc)
    last_viewer = next((str(t["content"]) for t in reversed(history) if t.get("role") == "viewer"), "")
    return {**state, "search_query": f"{last_viewer[:200]} {query}".strip()}


# ---------------------------------------------------------------- steps

def _retrieve(state: dict) -> dict:
    twin_id = state["twin_id"]
    query = state.get("search_query") or state["query"]
    video_id, at = state.get("video_id"), state.get("at_seconds")

    hits = embeddings.search(twin_id, query, top_k=CANDIDATE_K)
    watching_title = None
    if video_id:
        local = embeddings.search(twin_id, query, top_k=CANDIDATE_K, video_id=video_id)
        if local:
            watching_title = local[0]["video_title"]
        merged: dict[Any, dict] = {}
        for h in hits + local:
            merged.setdefault(h.get("id") or (h["video_id"], h["timestamp_seconds"]), h)
        hits = list(merged.values())

    top_rank = max((h.get("rank", 0.0) for h in hits), default=0.0) or 1.0

    def order(h: dict) -> float:
        bonus = 0.0
        if video_id and h["video_id"] == video_id:
            bonus = PLAYHEAD_BOOST / 2
            if at is not None:
                start, end = h["timestamp_seconds"], max(h.get("end_seconds", 0), h["timestamp_seconds"])
                dist = 0 if start <= at <= end else min(abs(start - at), abs(end - at))
                bonus += PLAYHEAD_BOOST * max(0.0, 1 - dist / PLAYHEAD_WINDOW_S)
        return h.get("rank", 0.0) / top_rank + bonus

    hits = sorted(hits, key=order, reverse=True)[:TOP_K]
    best = max((_evidence(h) for h in hits), default=0.0)
    # Drop excerpts far weaker than the best one: they only add noise.
    hits = [h for i, h in enumerate(hits) if i < 2 or _evidence(h) >= best - 0.2]
    return {**state, "hits": hits, "confidence": calibrate(best) if hits else 0.0,
            "watching_title": watching_title}


def _should_refuse(state: dict) -> bool:
    if not state["hits"]:
        return True
    persona: PersonaProfile = state["persona"]
    return persona.guardrails_enabled and state["confidence"] < settings.rag_min_confidence


def _refusal(state: dict) -> ChatResponse:
    return ChatResponse(
        twin_id=state["twin_id"], answer="", grounded=False,
        confidence=state["confidence"] if state["hits"] else 0.0,
        refused=True, refusal_reason=REFUSAL_REASON if state["hits"] else NOT_TRAINED,
    )


def _prompt_vars(state: dict) -> dict:
    persona: PersonaProfile = state["persona"]
    language = state.get("language") or "English"
    hits = state["hits"]
    name = persona.creator_name

    system_prompt = build_system_prompt(persona) if persona.tone_match_enabled else (
        f"You are {name}'s AI assistant. Answer viewers' questions using only the "
        "video excerpts you are given. Never guess."
    )
    if language != "English":
        # The grounding rules stay in force regardless of language.
        system_prompt += (
            f" Respond ONLY in {language}, even though the excerpts are in English. "
            "Translate naturally — don't just answer in English and note the language. "
            f"(The {NOT_IN_CONTEXT} reply stays exactly as written.)"
        )

    excerpts = "\n\n".join(
        f"[{i}] \"{h['video_title']}\" at {_fmt_ts(h['timestamp_seconds'])}\n{h['text']}"
        for i, h in enumerate(hits, 1)
    )
    watching = ""
    if state.get("watching_title"):
        at = state.get("at_seconds")
        where = f" at {_fmt_ts(at)}" if at is not None else ""
        watching = (
            f"The viewer is currently watching \"{state['watching_title']}\"{where}. "
            "Prefer excerpts from that part of the video when they answer the question.\n\n"
        )
    earlier = ""
    history = [t for t in (state.get("history") or []) if t.get("content")][-4:]
    if history:
        earlier = "Earlier in this chat (context only — not a source of facts):\n" + "\n".join(
            f"{'Viewer' if t.get('role') == 'viewer' else 'You'}: {str(t['content'])[:300]}" for t in history
        ) + "\n\n"

    user_prompt = (
        f"{watching}Excerpts from {name}'s videos (auto-generated captions: punctuation may be "
        f"missing and a few words misheard):\n\n{excerpts}\n\n"
        f"{earlier}Viewer question: {state['query']}\n\n"
        "How to answer:\n"
        "- Use only facts stated in the excerpts. Don't add outside knowledge, even if you know it.\n"
        "- Put the excerpt number in square brackets right after each fact you use, e.g. [2].\n"
        "- Captions spell numbers out (\"forty nine thousand six hundred\"); write them as digits (49,600).\n"
        "- 1-3 short sentences. Use a short list only if they ask for steps or several items.\n"
        f"- If the excerpts don't answer the question, reply with exactly {NOT_IN_CONTEXT} and nothing else."
    )
    return {"system": system_prompt, "user": user_prompt}


_CITE_RE = re.compile(r"\s*【?\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]】?")
_NOT_IN_CONTEXT_RE = re.compile(r"NOT[_ ]IN[_ ]CONTEXT", re.I)
_THINK_RE = re.compile(r"<think>.*?</think>", re.S | re.I)


def parse_answer(raw: str, n_excerpts: int) -> tuple[str, list[int], bool]:
    """-> (clean answer, cited excerpt indexes (0-based, in order), answerable)"""
    text = _THINK_RE.sub("", raw or "").strip()
    answerable = True
    m = _NOT_IN_CONTEXT_RE.search(text)
    if m:
        rest = _NOT_IN_CONTEXT_RE.sub("", text).strip(" .:-\n")
        # Leading "NOT_IN_CONTEXT" (whatever follows) = the model's verdict;
        # a stray token after a real answer is just dropped.
        if m.start() == 0 or len(rest.split()) < 6:
            return "", [], False
        text = rest
    cited: list[int] = []
    for group in _CITE_RE.findall(text):
        for num in re.split(r"[,;]", group):
            idx = int(num) - 1
            if 0 <= idx < n_excerpts and idx not in cited:
                cited.append(idx)
    text = _CITE_RE.sub("", text)
    text = re.sub(r"[ \t]+([.,!?;:])", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    return text, cited, answerable


def _package(state: dict, raw_answer: str) -> ChatResponse:
    hits = state["hits"]
    answer, cited, answerable = parse_answer(raw_answer, len(hits))
    if not answerable:
        return ChatResponse(
            twin_id=state["twin_id"], answer="", grounded=False, confidence=state["confidence"],
            refused=True, refusal_reason=NOT_COVERED_REASON,
        )
    if not answer:
        return ChatResponse(
            twin_id=state["twin_id"], answer="", grounded=False, confidence=state["confidence"],
            refused=True, refusal_reason=EMPTY_ANSWER,
        )
    focus = f"{state['query']} {answer}"
    citations: list[Citation] = []
    for idx in cited or [0]:
        h = hits[idx]
        ts, snippet = embeddings.pinpoint(h, focus)
        # Overlapping chunks can point at the same moment — cite it once.
        if any(c.video_id == h["video_id"] and abs(c.timestamp_seconds - ts) < 15 for c in citations):
            continue
        citations.append(Citation(
            video_id=h["video_id"], video_title=h["video_title"], timestamp_seconds=ts, snippet=snippet,
        ))
        if len(citations) == MAX_CITATIONS:
            break
    return ChatResponse(
        twin_id=state["twin_id"], answer=answer, grounded=True,
        confidence=state["confidence"], citations=citations, refused=False,
    )


# ---------------------------------------------------------------- chain

_chain: Any = None


def _build_chain() -> Any:
    """LCEL: retrieve -> branch(refuse | prompt -> llm -> parser -> package)."""
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.runnables import RunnableBranch, RunnableLambda, RunnablePassthrough

    prompt = ChatPromptTemplate.from_messages([("system", "{system}"), ("human", "{user}")])

    def call_llm(prompt_value) -> str:
        msgs = prompt_value.to_messages()
        return llm.generate(msgs[0].content, msgs[1].content)

    generate = (
        RunnablePassthrough.assign(
            answer=RunnableLambda(_prompt_vars) | prompt | RunnableLambda(call_llm) | StrOutputParser()
        )
        | RunnableLambda(lambda s: _package(s, s["answer"]))
    )
    return (
        RunnableLambda(_retrieve)
        | RunnableBranch((_should_refuse, RunnableLambda(_refusal)), generate)
    ).with_config(run_name="youtwin_rag")


def _get_chain() -> Any:
    global _chain
    if _chain is None:
        try:
            _chain = _build_chain()
        except Exception:
            logger.exception("LangChain unavailable — running the same steps without it")
            _chain = False
    return _chain


def orchestrator() -> str:
    return "langchain-lcel" if _get_chain() else "plain"


def _run(state: dict) -> ChatResponse:
    chain = _get_chain()
    if chain:
        return chain.invoke(state)
    state = _retrieve(state)
    if _should_refuse(state):
        return _refusal(state)
    v = _prompt_vars(state)
    return _package(state, llm.generate(v["system"], v["user"]))


# ---------------------------------------------------------------- public

def answer_query(twin_id: str, persona: PersonaProfile, query: str, language: str = "English",
                 video_id: Optional[str] = None, at_seconds: Optional[int] = None,
                 history: Optional[list[dict]] = None, viewer_name: Optional[str] = None) -> ChatResponse:
    if language == "English":
        reply = _small_talk(query, persona, viewer_name)
        if reply:
            return ChatResponse(twin_id=twin_id, answer=reply, grounded=False, confidence=0.0)

    state = _condense({
        "twin_id": twin_id, "persona": persona, "query": query, "language": language,
        "video_id": video_id, "at_seconds": at_seconds, "history": history or [],
    })

    cache_key = _cache_key(state["search_query"], language, persona, video_id, at_seconds)
    cached = store.get_cached_answer(twin_id, cache_key)
    if cached:
        return ChatResponse.model_validate_json(cached)

    response = _run(state)

    if response.grounded:
        store.set_cached_answer(twin_id, cache_key, response.model_dump_json())

    return response
