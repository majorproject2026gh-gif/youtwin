# YouTwin — Security audit (2 Oct 2026)

Scope: `frontend/`, `api-service/`, `ai-service/`, `extension/`, Dockerfiles and the
public GitHub repository history.

## Tools used

| Area | Tool | Result after fixes |
|---|---|---|
| Leaked secrets in Git history | gitleaks 8.21 (public repo, all commits) | No leaks |
| Leaked secrets in files | gitleaks (working tree, excluding local `.env`) | No leaks |
| JS dependencies | `npm audit` (frontend, api-service) | 0 vulnerabilities |
| Python dependencies | `pip-audit` on the fully resolved tree (176 packages) | 1 open, see below |
| Code patterns | Semgrep (JS/TS, Python, Dockerfile, secrets rules), Bandit | No exploitable findings left |
| Manual review | Auth, access control, CORS, injection, SSRF, XSS, rate limits | See table |

## Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Critical | `next` 16.3.4: remote code execution in `next/og` ImageResponse (GHSA-vcvr-r3jv-pc5j) | Upgraded to 16.3.8 |
| 2 | High | `axios` ≤ 1.19.0 (api-service): 12 advisories incl. SSRF via redirects, header injection, prototype-pollution gadgets | Upgraded to ^1.20.0 (frontend and api-service) |
| 3 | High | Python: 38 advisories in starlette, llama-index-core, langchain, langchain-core, langchain-community, yt-dlp, sentence-transformers, python-dotenv | Upgraded every one to a fixed release; removed unused `langchain` and `langchain-community` |
| 4 | High | `GET /chat/:twinId/history` was public: anyone with a share link (twin id is in every video description) could read every viewer's questions | Now requires login and twin ownership |
| 5 | Medium | No brute-force limit on login/sign-up (only the general 60 req/min) | 10 failed attempts per IP per 15 min (`authLimiter`) |
| 6 | Medium | Any signed-up user could trigger unlimited paid Replicate video generations | 5 generations per hour (`videoLimiter`) |
| 7 | Medium | Unbounded LLM output (cost / abuse) | `max_tokens` = 400 on Groq, OpenAI-compatible and Ollama (`LLM_MAX_TOKENS`) |
| 8 | Medium | Video links passed to yt-dlp / transcript API without strict validation | Only 11-character YouTube ids are accepted |
| 9 | Medium | ai-service sent `Access-Control-Allow-Origin: *` | CORS removed; only api-service calls it server-to-server |
| 10 | Medium | No `.dockerignore`: a local build copied `.env` (API keys) into the image | `.dockerignore` for each service excludes `.env*` |
| 11 | Medium | api-service and frontend containers ran as root | Run as the unprivileged `node` user |
| 12 | Low | JWT algorithm not pinned; weak secret possible | HS256 pinned on sign and verify; production refuses a `JWT_SECRET` shorter than 32 chars |
| 13 | Low | Minimum password length 6 | 8 (server and sign-up form) |
| 14 | Low | Frontend sent no security headers | CSP `frame-ancestors 'none'`, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS; `X-Powered-By` removed |
| 15 | Low | ai-service silently open if `AI_SERVICE_SECRET` is missing | Loud start-up warning |

## Accepted / remaining risks

- **nltk 3.10.3** (PYSEC-2026-3740, transitive via llama-index-core): no fixed release exists. It affects NLTK model-file save/load APIs that YouTwin never calls. Re-run `pip-audit` when 3.10.4+ ships.
- **Prompt injection**: there is no dedicated injection filter. The similarity guardrail refuses most off-topic instructions before the LLM runs, and the system prompt restricts answers to the retrieved context.
- **Session tokens in localStorage**: readable by any XSS. No XSS sink was found (all model output is rendered as text). HttpOnly cookies would need CSRF protection.
- **JWT revocation**: logging out deletes the token on the device; a stolen token stays valid until it expires (30 days).
- **Channel ownership**: the pasted channel is not checked against the linked Google account.
- **Root `Dockerfile` and root `pages/` folder**: a legacy copy, git-ignored and never deployed. Delete it when convenient.

## Re-running the checks

```bash
cd frontend && npm audit
cd api-service && npm audit
cd ai-service && pip install pip-audit && pip-audit -r requirements.txt
gitleaks git .          # https://github.com/gitleaks/gitleaks
```
