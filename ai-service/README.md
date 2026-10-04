---
title: YouTwin AI Service
emoji: 🎬
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# YouTwin — AI Service

The Python/FastAPI backend for YouTwin's ingestion, embedding, RAG
inference, and video-generation pipeline (modules M1–M4). Deployed here
on Hugging Face Spaces specifically because its free CPU tier provides
enough RAM for the ML models (sentence-transformers, faster-whisper,
spaCy) that Render/Railway's free tiers (512MB RAM) can't comfortably
fit.

This Space is called internally by YouTwin's `api-service` — it is not
meant to be used directly by end users. See `DEPLOYMENT.md` in the main
project repository for the full multi-service deployment guide.
