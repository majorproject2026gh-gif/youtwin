"""
Deterministic answers for questions *about the YouTwin project itself*
(e.g. "who built this?"), as opposed to questions about the creator's
video content.

Why this exists: M4's RAG guardrail only checks vector-similarity
*confidence*, not whether the retrieved context actually contains the
fact being asked about. A meta-question like "who built this project?"
can still retrieve a moderately-similar video segment (e.g. an intro
clip) and clear the confidence threshold, at which point the LLM is
asked to answer strictly "from context" but has no real fact to draw
on for that specific question — and may fabricate names to comply,
which is exactly the failure mode the zero-hallucination guardrail
exists to prevent.

Since the team roster is a fixed fact and not something that should
ever depend on retrieval or generation, we short-circuit these
questions with a canned, verified answer instead of letting them reach
the LLM at all.
"""
from __future__ import annotations

import re

TEAM = ["Sadiyanureen Hussain", "Virender Singh", "Harvinder Singh", "Mayank Bambal"]
GROUP_NUMBER = "CSE_C_06"
INSTITUTION = "GHRCE Nagpur"

_META_PATTERNS = [
    re.compile(r"\bwho\s+(built|made|created|developed|coded|designed)\s+(this|youtwin|the\s+(project|app|twin))\b", re.I),
    re.compile(r"\bwho\s+(is|are)\s+(behind|the\s+team\s+behind)\s+(this|youtwin)\b", re.I),
    re.compile(r"\bwho('?s| is)\s+your\s+(team|creator[s]?|developer[s]?)\b", re.I),
]


def match_project_meta_question(query: str) -> bool:
    """True if the viewer is asking about the app/project itself rather
    than about the creator's video content."""
    return any(p.search(query) for p in _META_PATTERNS)


def project_meta_answer() -> str:
    return (
        f"This twin was built as YouTwin, a project by four of us — "
        f"{', '.join(TEAM[:-1])}, and {TEAM[-1]} — for {GROUP_NUMBER} at {INSTITUTION}."
    )
