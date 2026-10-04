# YouTwin — A Digital Twin Based Interaction Framework for Content Generation and Validation using Generative AI

CSE_C_06 · GHRCE Nagpur · Winter 2026

A zero-hallucination AI agent that clones a YouTube creator's voice from their own video
library and lets viewers chat with a grounded, timestamp-cited "digital twin" of the
creator — trained on real captions/transcripts, refusing to answer rather than guessing
when nothing in the creator's videos supports a claim.

**Team:** Mayank Bambal (C_64) · Sadiyanureen Hussain (C_56) · Virender Singh (C_44) · Harvinder Singh (C_26)
**Guide:** Dr. Apeksha Sakhare, Assistant Professor, GHRCE Nagpur

---

## Architecture (maps 1:1 to the Module Description slide)

```
Creator's YouTube Videos
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ ai-service/  (Python, FastAPI)                                     │
│                                                                     │
│  M1 Multimodal Ingestion      → app/ingestion.py   (YouTube API +  │
│                                   yt-dlp + faster-whisper, caption- │
│                                   first with Whisper fallback)      │
│  M2 Stylometric Extraction    → app/stylometry.py  (spaCy → persona│
│                                   definition file)                  │
│  M3 Vector Embedding & Index  → app/embeddings.py  (sentence-      │
│                                   transformers + Qdrant HNSW)       │
│  M4 RAG-based Inference       → app/rag.py         (LangChain +    │
│                                   Groq-hosted LLM, confidence-gated │
│                                   guardrail — refuses low-confidence│
│                                   answers instead of hallucinating) │
│                                                                     │
│  + mcp_server.py — exposes ask_twin/get_twin_persona as Model      │
│    Context Protocol tools for any MCP-compatible AI client          │
│  + app/video_gen.py — AI video-generation agent via Replicate       │
└───────────────────────────────────────────────────────────────────┘
        │  internal REST, authenticated via shared secret once deployed
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ api-service/  (TypeScript, Node.js/Express)                         │
│  M5 Response Serialization    → src/routes/chat.ts, twin.ts,        │
│                                   auth.ts, video.ts (Google OAuth,   │
│                                   multi-twin persistence, Postgres   │
│                                   via Prisma, rate limiting, helmet) │
└───────────────────────────────────────────────────────────────────┘
        │  public REST
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ frontend/  (Next.js 16 + React 19 + Tailwind)                       │
│  /dashboard/connect,train,review,share  → creator wizard, each step │
│                       its own full-page experience                  │
│  /dashboard/twins     → manage every trained twin, each with its    │
│                       own permanent share link                      │
│  /dashboard/analytics → real usage metrics per twin                 │
│  /dashboard/create-video → AI video generation agent                │
│  /twin/[handle]/...   → viewer flow: find link → open → chat        │
│                       (multi-language, voice input, topic explorer) │
│                       → upgrade                                     │
└───────────────────────────────────────────────────────────────────┘
```

## Key features

- **Multi-twin support** — train a separate, independently-addressable twin per video;
  each gets its own permanent share link (`/dashboard/twins` lists and manages them all)
- **Zero-hallucination guardrail** — confidence-gated retrieval; refuses rather than guesses
- **Timestamp-cited answers** — every grounded response traces back to the exact second
  in the exact video it came from
- **AI video-generation agent** — text-to-video via Replicate, with YouTube upload
- **Real analytics** — grounded rate, confidence, top questions, 14-day trend, per twin
- **Multi-language chat** — English, Hindi, Spanish, French, Marathi
- **Voice input** — browser-native speech recognition, zero extra dependencies
- **Topic Explorer** — browse real indexed moments from a creator's videos
- **Light/dark theme toggle** — on login and home
- **MCP server** — YouTube's core chat capability exposed as Model Context Protocol
  tools, audited with Cisco AI Defense's `mcp-scanner` (see `ai-service/mcp_server.py`)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API layer | Node.js, Express, Prisma, PostgreSQL (Neon) |
| AI service | Python, FastAPI, LangChain |
| LLM | Groq-hosted `openai/gpt-oss-120b` (swap via `GROQ_MODEL`) |
| Vector store | Qdrant Cloud (HNSW indexing) |
| Speech-to-text | faster-whisper (captions preferred; Whisper is the fallback) |
| Stylometry | spaCy |
| Embeddings | sentence-transformers |
| Video generation | Replicate |
| Auth | JWT (username/password) + Google OAuth (YouTube channel access) |

## Security

- `helmet` HTTP security headers on every api-service response
- Per-route rate limiting (general + a tighter limit on chat specifically)
- Basic brute-force/credential-stuffing detection (flags repeated failed-auth attempts per IP)
- CORS restricted to the known frontend origin
- Shared-secret authentication between api-service and ai-service (`AI_SERVICE_SECRET`) —
  required once ai-service is deployed publicly, so it can verify requests genuinely come
  from api-service rather than trusting any caller
- Dependency vulnerabilities patched via `npm audit` + explicit `overrides` where a fix
  requires a version bump upstream packages haven't shipped yet
- MCP server tool descriptions hardened against the 12 attack categories in Cisco AI
  Defense's `mcp-scanner` threat taxonomy (documented in `mcp_server.py`'s file header)

## Quickstart (local development)

### 1. Prerequisites
- Node.js 20+
- Python 3.11+
- A free [Groq](https://console.groq.com) API key
- A [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key + Google OAuth client (optional — sample data works without either)
- A [Qdrant Cloud](https://cloud.qdrant.io) free-tier cluster
- A [Neon](https://neon.tech) free-tier Postgres database

### 2. Start the AI service
```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env   # fill in your keys
uvicorn app.main:app --reload --port 8001
```

### 3. Start the API service
```bash
cd api-service
npm install
cp .env.example .env   # fill in your keys, AI_SERVICE_URL=http://localhost:8001
npx prisma migrate dev
npm run dev   # http://localhost:4000
```

### 4. Start the frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

### 5. Try it
1. Go to `http://localhost:3000` → sign up → `/dashboard/connect`
2. Authorize a Google account for channel access (or skip ahead — sample data needs no YouTube access)
3. Train on a specific video, a channel, or "Load sample creator" for mock data
4. Review the extracted persona, then get a permanent share link
5. Visit `/dashboard/twins` any time to see and manage every twin you've trained

## Evaluating the guardrail

`evaluate.py` (project root) runs a labeled test set of questions against your live
trained twin and computes real Accuracy, Precision, Recall, F1, guardrail false-positive
rate, average confidence, and latency — see the file's own docstring for setup. Edit the
test questions to match whatever your twin is actually trained on before running; the
resulting numbers are only meaningful if the labels are honest.

## Deploying publicly

See `DEPLOYMENT.md` for the full step-by-step guide — frontend on Vercel, api-service on
Render, ai-service on Render (Starter tier, for the RAM the ML models need) or Hugging
Face Spaces as a free alternative. Includes the exact environment variables each service
needs and how to close the loop on CORS/OAuth once you have real deployed URLs.

## Repo layout

```
youtwin/
├── ai-service/       Python FastAPI — ingestion, stylometry, embeddings, RAG, video gen, MCP server (M1-M4)
├── api-service/       Node/TypeScript Express — auth, multi-twin persistence, serialization (M5)
├── frontend/           Next.js — creator dashboard wizard + multi-twin management + viewer chat flow
├── evaluate.py         Real evaluation metrics against a live trained twin
├── DEPLOYMENT.md        Step-by-step public deployment guide
└── GIT_SETUP.md         Git/GitHub setup guide
```

See each folder's own README/comments for further detail.
