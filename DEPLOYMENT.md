# YouTwin — Deployment Guide

Deploys the three services to real hosting, with a public share link
that works from anywhere — not just your laptop's localhost.

**Architecture — every piece of this is on a $0/month tier:**
- `frontend` → **Vercel**, free Hobby tier (native Next.js support)
- `api-service` → **Render**, free tier (lightweight Node/Express —
  512MB RAM is enough here)
- `ai-service` → **Render**, free tier (0.1 CPU / 512MB RAM) — a
  deliberate gamble, not a comfortable fit. This service loads real ML
  models (sentence-transformers, faster-whisper, spaCy), and Render
  itself documents this free tier as "not for AI inference." Two
  things make it *possible* rather than reckless:
  1. Every model in this codebase already loads lazily, on first use,
     not at startup — so the service idles light and only spikes when
     an actual embedding/transcription/stylometry call happens.
  2. The Dockerfile now installs the CPU-only PyTorch build instead of
     the CUDA build `pip install torch` pulls by default — several GB
     of unused NVIDIA runtime libraries this CPU-only host would
     otherwise map into memory for nothing.
  It can still run out of memory under real load (concurrent chats,
  or a video without captions falling back to local Whisper
  transcription) and get killed and restarted by Render — if that
  happens repeatedly, Render Starter ($7/month, same Dockerfile, no
  code changes, just a dropdown change) is the immediate fix.
  (Hugging Face Spaces — the free alternative that used to make sense
  here — changed its policy in July 2026 and now requires a paid plan
  for Docker Spaces, so it's off the table.)

Your database (Neon Postgres), vector store (Qdrant Cloud), and cache
(Upstash Redis) are **already** free-tier cloud services — nothing to
change there.

**Order matters** — deploy in this sequence, since each step needs a
URL produced by the previous one:
1. ai-service → Render
2. api-service → Render (needs ai-service's URL)
3. frontend → Vercel (needs api-service's URL)
4. Go back and update api-service + Google OAuth with the real frontend URL

---

## 0. Generate your internal secret

This is the shared secret that lets `api-service` prove its requests
to `ai-service` are legitimate, now that `ai-service` will be publicly
reachable. Generate one random value and use it for BOTH services below:

```
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Keep it only in each service's real `.env` / Render environment
variables — never paste the real value into this file or anything else
that's committed to git (this file previously contained a real secret,
which must be treated as leaked and replaced).

---

## 1. Deploy ai-service → Render

1. Create a free account at `render.com`, connect your GitHub
2. **New +** → **Web Service** → select your `youtwin` GitHub repo
3. **Root Directory**: `ai-service`
4. **Runtime**: Docker (it'll detect the existing Dockerfile)
5. **Instance Type**: **Free** (0.1 CPU / 512MB). This is the risky
   part described above — proceed, but read the "If it crashes" note
   below before you're relying on this for a live demo.
6. Under **Environment Variables**, click **Add from .env** and paste
   in everything from your real `ai-service/.env` — `QDRANT_URL`,
   `QDRANT_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, `YOUTUBE_API_KEY`,
   `REPLICATE_API_TOKEN`, `WHISPER_MODEL_SIZE`, `WHISPER_DEVICE`,
   `RAG_MIN_CONFIDENCE`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`,
   plus:
   ```
   AI_SERVICE_SECRET=<the secret you generated in step 0>
   ```
   (must match `api-service`'s `AI_SERVICE_SECRET` exactly)
7. Click **Create Web Service** — Render builds and deploys
   automatically (watch the **Logs** tab; first build is slow, several
   minutes, since it's installing torch/sentence-transformers)
8. Once live, copy the URL Render gives you, e.g.:
   ```
   https://youtwin-ai-service.onrender.com
   ```
   Test it: visit `https://youtwin-ai-service.onrender.com/health` in
   a browser — should return `{"status":"ok"}`.

**If it crashes** (the deploy shows the service restarting repeatedly,
or a log line mentioning "Out of memory" / "OOM" / the process being
killed): that's the 512MB limit being hit for real, not a config
mistake. Go to this service in the Render dashboard → **Settings** →
**Instance Type** → switch to **Starter** ($7/month) → save. Same
Dockerfile, same env vars, nothing else changes — it'll redeploy on
the new tier automatically.

---

## 2. Deploy api-service → Render

1. Create a free account at `render.com`, connect your GitHub
2. **New +** → **Web Service** → select your `youtwin` GitHub repo
3. **Root Directory**: `api-service`
4. **Runtime**: Docker (it'll detect the existing Dockerfile)
5. **Instance Type**: Free
   (Database migrations run automatically on every start — `npm start`
   runs `prisma migrate deploy` first — so no separate step is needed.)
6. Under **Environment Variables**, add everything from your
   `api-service/.env`:
   ```
   PORT=4000
   DATABASE_URL=<your real Neon connection string>
   AI_SERVICE_URL=https://youtwin-ai-service.onrender.com   # the ai-service URL from step 1.8 above
   GOOGLE_CLIENT_ID=<your real client ID>
   JWT_SECRET=<your real JWT secret>
   FRONTEND_URL=http://localhost:3000
   AI_SERVICE_SECRET=<the secret you generated in step 0>
   ```
   (`FRONTEND_URL` is a placeholder for now — you'll update it in step 4
   once Vercel gives you the real frontend URL.)
7. Click **Create Web Service** — Render builds and deploys
   automatically. Watch the **Logs** tab.
8. Once live, your api-service URL is shown at the top of the dashboard,
   something like:
   ```
   https://youtwin-api.onrender.com
   ```
9. **Important — free tier spins down after 15 minutes idle**, causing
   a ~30-60 second delay on the first request after a gap. Not a bug —
   just how Render's free tier works. Worth mentioning if a committee
   member hits a slow first load.

---

## 3. Deploy frontend → Vercel

1. Create a free account at `vercel.com`, connect your GitHub
2. **Add New** → **Project** → select your `youtwin` repo
3. **Root Directory**: `frontend`
4. Framework preset should auto-detect as **Next.js**
5. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL=https://youtwin-api.onrender.com
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your real Google client ID>
   ```
6. Click **Deploy**
7. Once live, Vercel gives you a real URL, e.g.:
   ```
   https://youtwin-yourname.vercel.app
   ```

---

## 4. Close the loop — update the URLs that depend on this

**a) Update Render's `FRONTEND_URL`:**
Render dashboard → your api-service → Environment → change
`FRONTEND_URL` to your real Vercel URL → save (triggers auto-redeploy).

**b) Update Google OAuth authorized origins:**
1. `console.cloud.google.com` → your project → APIs & Services →
   Credentials → your OAuth 2.0 Client ID
2. Under **Authorized JavaScript origins**, click **Add URI**, add your
   Vercel URL exactly (no trailing slash):
   ```
   https://youtwin-yourname.vercel.app
   ```
3. Save. Takes a few minutes to propagate.

**c) Update the OAuth consent screen test users** (if your app is still
in Testing mode) to include whichever Google accounts will actually
test sign-in on the deployed version.

---

## 5. Test end-to-end

1. Open your real Vercel URL on your **phone**, on mobile data (not
   WiFi) — this is the real test, since it proves it's not just working
   because you're on the same network as your laptop
2. Sign up, connect a Google account, try training (sample data is
   the safe first test), review, and get a real share link — that link
   will now be your actual Vercel URL + a real path, not the
   `youtwin.ai` placeholder text
3. Paste *that* real link in a video description — it will actually work

---

## 6. Ongoing updates — how a future code change actually reaches the live site

This is the part most guides skip: once you've done the initial deploy above, your
project doesn't stay frozen. You'll keep editing code locally — the question is how
that turns into the live site updating.

**The short answer: git push does it automatically, for all three services.** Vercel
and both Render services are connected directly to your GitHub repo (steps 1-3 above).
Every time you push to your `main` branch, each platform notices the new commit on its
own, rebuilds that service from scratch, and swaps it in as the new live version — no
dashboard button to click. Frontend changes on Vercel are typically live in 1-3
minutes; the two Render services take a few minutes longer since they rebuild a Docker
image each time.

**Recommended workflow while you're still actively building this:**

1. Keep developing exactly like now — `npm run dev` locally, test the change in your
   browser, on your own machine, before it goes anywhere near GitHub.
2. For anything beyond a one-line tweak, work on a branch instead of committing
   straight to `main`:
   ```
   git checkout -b fix/whatever-you-are-changing
   git add .
   git commit -m "Describe what changed"
   git push -u origin fix/whatever-you-are-changing
   ```
3. Open a Pull Request on GitHub for that branch. Vercel automatically builds a
   **Preview Deployment** for it — a separate, real, shareable URL that shows exactly
   that branch's version of the frontend, completely untouched from your live
   production site. Click through it before merging. (Render's free/Starter tiers
   don't do this automatically for `api-service`/`ai-service` — that's a paid Render
   feature — so for backend changes, your local testing in step 1 is what stands in
   for a preview.)
4. Merge the PR into `main`. That push is what triggers the real production rebuild
   on both Vercel and Render, replacing what's currently live.

**Two things that do NOT update automatically — you have to change them by hand
whenever they change:**

- **Environment variables.** Your local `.env` files are gitignored and never get
  pushed, so if you add or change an API key or setting, you also have to add it in
  the Vercel dashboard (frontend → Settings → Environment Variables) and/or the
  Render dashboard (that service → Environment) — then redeploy. Vercel redeploys
  automatically when you save a new env var there; on Render, click **Manual Deploy**
  if it doesn't kick off on its own.
- **Database schema changes (Prisma).** Running `npx prisma migrate dev` locally only
  touches your local Postgres — it never reaches the live Neon database by itself.
  After merging a migration, run `npx prisma migrate deploy` once against your real
  production `DATABASE_URL` (from your machine, using the Neon connection string), or
  better, add it to api-service's Render **Build Command** so it happens automatically
  on every deploy:
  ```
  npx prisma migrate deploy && npm run build
  ```

**If a push breaks the live site:** both platforms keep deploy history, so rollback is
one click, not a fire drill. Vercel → your project → **Deployments** tab → find the
last good one → **Promote to Production**. Render → your service → **Deploys** tab →
find the last good one → **Redeploy**.

---

## Honest caveats

- **Both Render free-tier services sleep when idle** and take
  30-60+ seconds to wake on the first request after a gap — not a
  bug, just what "free" costs here. `frontend` on Vercel doesn't have
  this problem; it's served statically/via CDN. Worth mentioning if a
  committee member hits a slow first load.
- **`ai-service` can run out of memory on the free tier under real
  load** — see the "If it crashes" note in step 1. The Dockerfile
  minimizes this (lazy model loading, CPU-only torch) but 512MB is
  still genuinely tight for these models; Render Starter ($7/month)
  is the fix if it becomes a real problem rather than a hypothetical
  one.
- **Whisper transcription will be slow** on ai-service's CPU compute
  for any video without captions — lean on the captions-first path.
- This whole guide assumes you're doing this **after**, not during, your
  presentation crunch — deploying three services for the first time
  always surfaces at least one unexpected config issue.

## Browser sidebar extension (M5 delivery channel)

The `extension/` folder is a Chrome/Edge Manifest V3 side panel. It is not
deployed anywhere — load it with `chrome://extensions` → Developer mode →
**Load unpacked** → pick `extension/`, then click ⚙ in the panel and enter
your Vercel URL (web app) and Render URL (api-service). See
`extension/README.md`.

No server setting is needed: api-service accepts `chrome-extension://`
origins on the public viewer routes only (`/twins/by-handle`,
`/twins/by-id`, `/chat`). Creator/auth routes stay locked to
`FRONTEND_URL`.

## ai-service dependency note

`fastmcp` is no longer in `ai-service/requirements.txt`: it requires
pydantic ≥ 2.12, which conflicts with the pinned pydantic 2.9.2, so a
fresh Docker build failed with `ResolutionImpossible`. `mcp_server.py`
is optional and runs in its own venv — see `ai-service/requirements-mcp.txt`.
`llama-index-core` (persona definition file) and `langchain-core`
(RAG chain) were added; the set resolves cleanly with `pip install -r`.
