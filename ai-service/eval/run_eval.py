"""
Retrieval + guardrail evaluation for YouTwin's M3/M4 pipeline.

Indexes the four test videos in eval/corpus.py into an in-memory Qdrant,
asks 62 answerable viewer questions (45 paraphrased + 17 quoting exact
names) and 24 questions the videos don't answer, and reports:

  recall@1 / recall@5 / MRR  - is the passage holding the answer ranked
                               first / in the 5 excerpts given to the LLM
  answered                   - answerable questions that pass guardrail 1
  refused                    - unanswerable questions stopped by guardrail 1
                               (the LLM's NOT_IN_CONTEXT check is guardrail 2)

No API keys or network needed beyond the embedding model download.

    cd ai-service
    python -m eval.run_eval
"""
from __future__ import annotations

import json
import time

import numpy as np
from qdrant_client import QdrantClient

from app import embeddings, rag
from app.config import settings
from app.schemas import PersonaProfile

from . import corpus


def main() -> None:
    embeddings._client = QdrantClient(":memory:")
    twin = "eval"
    t0 = time.time()
    n_chunks = embeddings.embed_and_index(twin, corpus.transcripts())
    index_s = time.time() - t0
    persona = PersonaProfile(twin_id=twin, creator_name="Creator")

    def retrieve(q: str) -> dict:
        return rag._retrieve({"twin_id": twin, "query": q, "persona": persona})

    questions = corpus.QUESTIONS + corpus.KEYWORD_QUESTIONS
    r1 = r5 = mrr = 0.0
    pos, misses = [], []
    for q, _vid, gold in questions:
        state = retrieve(q)
        g = corpus._norm(gold)
        rank = next((i for i, h in enumerate(state["hits"]) if g in corpus._norm(h["text"])), None)
        if rank is None:
            misses.append(q)
        else:
            r5 += 1
            mrr += 1 / (rank + 1)
            r1 += rank == 0
        pos.append(state["confidence"])
    neg = [retrieve(q)["confidence"] for q in corpus.UNANSWERABLE]
    P, N = np.array(pos), np.array(neg)
    thr = settings.rag_min_confidence
    n = len(questions)
    print(json.dumps({
        "embedding_model": settings.embedding_model,
        "chunks": n_chunks,
        "index_seconds": round(index_s, 1),
        "questions": {"answerable": n, "unanswerable": len(N)},
        "recall@1": round(r1 / n, 3),
        "recall@5": round(r5 / n, 3),
        "MRR": round(mrr / n, 3),
        "threshold": thr,
        "answered": round(float((P >= thr).mean()), 3),
        "refused_unanswerable": round(float((N < thr).mean()), 3),
        "auc": round(float(np.mean([[p > x for x in N] for p in P])), 3),
    }, indent=2))
    if misses:
        print("not in top 5:", misses)


if __name__ == "__main__":
    main()
