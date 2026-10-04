"""
M2 - Stylometric Extraction Module
spaCy · (persona definition assembly, LLaMA-Index-style profile)

Profiles sentence structure, speaking pace, and vocabulary with spaCy,
then builds a persona definition file that captures the creator's
unique voice — tone descriptors, catchphrases, and a sample opening
line the RAG layer uses as a style anchor.
"""
from __future__ import annotations

import re
from collections import Counter

import spacy

from .ingestion import VideoTranscript
from .persona_file import select_style_exemplars
from .schemas import PersonaProfile

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            # graceful fallback if the model wasn't downloaded yet
            _nlp = spacy.blank("en")
            if "sentencizer" not in _nlp.pipe_names:
                _nlp.add_pipe("sentencizer")
    return _nlp


_FILLER_TONE_WORDS = {
    "honestly": "candid", "literally": "emphatic", "basically": "casual",
    "guys": "conversational", "so": "casual", "actually": "direct",
}

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "so", "to", "of", "in", "on",
    "is", "it", "i", "you", "we", "my", "me", "for", "with", "that",
    "this", "just", "be", "was", "are", "at", "as", "if", "do", "did",
    "get", "got", "let", "know", "want", "video", "today",
}


def extract_persona(twin_id: str, creator_name: str, transcripts: list[VideoTranscript]) -> PersonaProfile:
    nlp = _get_nlp()
    full_text = " ".join(t.full_text for t in transcripts)
    doc = nlp(full_text)

    sentences = list(doc.sents)
    sentence_lengths = [len(sent.text.split()) for sent in sentences] or [0]
    avg_sentence_length = sum(sentence_lengths) / len(sentence_lengths)

    total_words = len(full_text.split())
    # Spoken duration per video ≈ start of its last segment plus one
    # average segment length. (This used to SUM every segment's start
    # time, which grows quadratically with video length and produced a
    # meaningless words-per-minute figure on the Review screen.)
    total_seconds = 0.0
    for t in transcripts:
        if not t.segments:
            continue
        starts = [s.start_seconds for s in t.segments]
        last = max(starts)
        avg_gap = (last - min(starts)) / (len(starts) - 1) if len(starts) > 1 else 5
        total_seconds += last + max(avg_gap, 1)
    speaking_pace_wpm = round((total_words / total_seconds) * 60, 1) if total_seconds > 0 else 0.0

    words = re.findall(r"[a-zA-Z']+", full_text.lower())
    word_freq = Counter(w for w in words if w not in _STOPWORDS and len(w) > 2)
    top_vocabulary = [w for w, _ in word_freq.most_common(15)]

    tone_hits = [
        _FILLER_TONE_WORDS[w] for w in words if w in _FILLER_TONE_WORDS
    ]
    tone_counter = Counter(tone_hits)
    tone_descriptors = [t for t, _ in tone_counter.most_common(4)] or ["neutral"]

    # crude catchphrase detection: repeated 3-4 gram sequences
    catchphrases = _detect_ngram_repeats(full_text, n=3, min_count=2)[:5]

    sample_opening_line = sentences[0].text.strip() if sentences else ""

    # LlamaIndex step: sentence nodes -> the lines that best carry this
    # creator's voice, for the persona definition file + system prompt.
    style_exemplars, _ = select_style_exemplars(
        [(t.title, t.full_text) for t in transcripts],
        top_vocabulary, catchphrases, set(_FILLER_TONE_WORDS),
    )

    return PersonaProfile(
        twin_id=twin_id,
        creator_name=creator_name,
        tone_descriptors=tone_descriptors,
        avg_sentence_length=round(avg_sentence_length, 1),
        speaking_pace_wpm=speaking_pace_wpm,
        top_vocabulary=top_vocabulary,
        catchphrases=catchphrases,
        sample_opening_line=sample_opening_line,
        style_exemplars=style_exemplars,
    )


def _detect_ngram_repeats(text: str, n: int, min_count: int) -> list[str]:
    tokens = re.findall(r"[a-zA-Z']+", text.lower())
    grams = [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]
    counts = Counter(grams)
    return [g for g, c in counts.most_common() if c >= min_count]


def build_system_prompt(persona: PersonaProfile) -> str:
    """Turns the extracted persona into the system prompt used by the RAG
    module (M4) so responses sound like the creator."""
    tone = ", ".join(persona.tone_descriptors) or "casual and friendly"
    vocab = ", ".join(persona.top_vocabulary[:8])
    catchphrases = "; ".join(persona.catchphrases) or "none detected yet"

    exemplars = ""
    if persona.style_exemplars:
        exemplars = (
            "Example lines in their own words (style reference only — never "
            "treat these as facts to answer from):\n"
            + "\n".join(f"- \"{e[:220]}\"" for e in persona.style_exemplars[:5])
            + "\n"
        )

    return (
        f"You are {persona.creator_name}'s AI digital twin, speaking to a viewer "
        f"of {persona.creator_name}'s YouTube channel.\n"
        f"Voice: {tone}. Average sentence length ~{persona.avg_sentence_length} words. "
        f"Frequently used words: {vocab}.\n"
        f"Recurring phrases: {catchphrases}.\n"
        f"{exemplars}"
        "Rules:\n"
        "1. Only answer using the provided video excerpts. Never invent facts, "
        "products, prices or opinions the creator hasn't stated — even if you know them.\n"
        "2. If the excerpts don't clearly answer the question, reply exactly "
        "NOT_IN_CONTEXT — never guess.\n"
        "3. Stay fully in character as the creator's voice at all times. "
        "Never break character or mention you are an AI unless directly asked.\n"
        "4. Keep replies conversational and short, matching the creator's tone above.\n"
        f"5. The source video context was spoken aloud, so it may refer to you "
        f"with a bare pronoun like \"me\" or \"I\" inside a list of other people's "
        f"names (e.g. \"...Alex, Sam, and me\"). A text-chat viewer can't hear "
        f"who \"me\" is, so when that happens, replace it with your own name, "
        f"\"{persona.creator_name}\", instead of leaving a bare \"me\"/\"I\" next "
        f"to other people's names."
    )
