# YouTwin — A Digital Twin Based Interaction Framework for Content Generation and Validation using Generative AI

CSE_C_06 · GHRCE Nagpur · Winter 2026

This is a full working implementation of the YouTwin architecture described in the project seminar deck:
a zero-hallucination AI agent that clones a YouTube creator's voice from their own video library and lets
viewers chat with a grounded, timestamp-cited "digital twin" of the creator.

## Architecture (maps 1:1 to the Module Description slide)

```
Creator's YouTube Videos
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ ai-service/  (Python, FastAPI)                                     │
│                                                                     │
│  M1 Multimodal Ingestion      → app/ingestion.py   (YouTube API +   │
│                                   yt-dlp + faster-whisper "Whisper- │
│                                   v3")                              │
│  M2 Stylometric Extraction    → app/stylometry.py  (spaCy → persona │
│                                   definition file)                  │
│  M3 Vector Embedding & Index  → app/embeddings.py  (sentence-       │
│                                   transformers + Qdrant HNSW)       │
│  M4 RAG-based Inference       → app/rag.py         (LangChain +     │
│                                   Llama-3-70B via Ollama/Groq,       │
│                                   confidence-gated guardrail)       │
└───────────────────────────────────────────────────────────────────┘
        │  internal REST (localhost only)
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ api-service/  (TypeScript, Node.js/Express)                        │
│  M5 Response Serialization    → src/routes/chat.ts, twin.ts,        │
│                                   auth.ts (Google OAuth, share       │
│                                   links, Postgres via Prisma)       │
└───────────────────────────────────────────────────────────────────┘
        │  public REST
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ frontend/  (Next.js + Tailwind)                                    │
│  /dashboard        → creator journey map screen 1 (connect →        │
│                       train → review persona → share link)          │
│  /twin/[handle]     → viewer journey map screen 2 (chat page,        │
│                       grounded + timestamped replies)                │
└───────────────────────────────────────────────────────────────────┘
```

## Why these specific free/self-hostable choices

Your slide deck's spec sheet (Pinecone, Llama-3-70B, AWS g5.2xlarge) is a *production* target. For a working,
runnable-today prototype you can actually demo/defend, this repo swaps in equivalents that cost nothing and
still match the architecture on paper:

| Slide spec        | This repo (free)                    | Swap back to slide spec later by |
|--------------------|--------------------------------------|-----------------------------------|
| Pinecone           | Qdrant (self-hosted via Docker)       | changing `VECTOR_DB=pinecone` + key |
| Llama-3-70B (AWS)  | Ollama `llama3` locally (default), or Groq's free-tier `llama-3.3-70b-versatile` hosted API | changing `LLM_PROVIDER=groq` and adding `GROQ_API_KEY` |
| Whisper-v3         | `faster-whisper` (`large-v3` weights), runs on CPU or GPU | already the real model, just an efficient local runtime |
| AWS EC2 g5.2xlarge | Your own machine / any Docker host    | deploy the same containers to EC2 |

Nothing about the module boundaries changes — you're only swapping the infrastructure provider behind each module.

## Quickstart

### 1. Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.11+
- (Optional, for real Llama-3-70B) A free [Groq](https://console.groq.com) API key
- (Optional, for real ingestion) A [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key + Google OAuth client

### 2. Start infra (Qdrant + Postgres + Ollama)
```bash
cd infra
docker compose up -d
docker exec -it youtwin-ollama ollama pull llama3
```

### 3. Start the AI service
```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env   # fill in keys (all optional — sane local defaults exist)
uvicorn app.main:app --reload --port 8000
```

### 4. Start the API service
```bash
cd api-service
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev   # http://localhost:4000
```

### 5. Start the frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

### 6. Try it
1. Go to `http://localhost:3000/dashboard`
2. Paste a YouTube channel ID (or use "Load sample creator" for mock data — no API keys needed)
3. Watch it ingest → train → generate a persona
4. Copy the share link, open it in a new tab, and chat with the twin

## Repo layout
```
youtwin/
├── ai-service/     Python FastAPI — ingestion, stylometry, embeddings, RAG (M1-M4)
├── api-service/    Node/TypeScript Express — auth, persistence, serialization (M5)
├── frontend/       Next.js — creator dashboard + viewer chat page
└── infra/          docker-compose for Qdrant, Postgres, Ollama
```

See each folder's own README/comments for details.
