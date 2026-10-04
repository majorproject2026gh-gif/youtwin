import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import twinRoutes from "./routes/twin";
import chatRoutes from "./routes/chat";
import videoRoutes from "./routes/video";
import { clientKey } from "./lib";

// Last-resort safety net: an unhandled promise rejection anywhere in the
// process (e.g. a database call in a route we forgot to wrap in
// try/catch) terminates the whole Node process by default from Node 15+
// onward. That's what took the entire api-service down over a single
// Neon connection hiccup earlier — this keeps the server alive and just
// logs the error instead. Individual routes should still handle their
// own errors properly (see lib.ts's handleDbError); this is a backstop,
// not a substitute for that.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (server staying up):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server staying up):", err);
});

const app = express();

// Render / Vercel / most PaaS hosts sit behind one reverse proxy. Without
// this, req.ip is the proxy's address for EVERY visitor — so the rate
// limiters below would lump all users into a single bucket (one busy
// viewer could lock everyone out), and express-rate-limit v7 logs an
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR validation error on every request.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

// Security headers (helmet) — sets X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security, Cross-Origin-Resource-Policy,
// and a baseline Content-Security-Policy automatically. This is the same
// class of hardening enterprise security tooling (e.g. Cisco's web/app
// protection products) applies at the network edge — helmet applies it
// at the application layer instead, which is the correct place for a
// project at this scale rather than provisioning paid infrastructure.
app.use(helmet());

// CORS: the web app's own origin for everything. The YouTwin browser
// sidebar (a Chrome extension, see /extension) additionally gets the
// PUBLIC viewer routes only — resolving a twin link and chatting — never
// auth or creator routes. Auth is a Bearer header (no cookies), so this
// is not a CSRF surface either way.
const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? "http://localhost:3000";
const EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/[a-p]{32}$/;
const EXTENSION_PUBLIC_PATH_RE = /^\/(chat(\/.*)?|twins\/by-(handle|id)\/[^/]+)$/;
app.use(
  cors<express.Request>((req, cb) => {
    const origin = req.header("Origin");
    const allowExtension =
      !!origin && EXTENSION_ORIGIN_RE.test(origin) && EXTENSION_PUBLIC_PATH_RE.test(req.path);
    cb(null, { origin: allowExtension ? origin : FRONTEND_ORIGIN });
  }),
);
app.use(express.json({ limit: "100kb" }));

// Basic threat-pattern logging: flags repeated failed-auth attempts
// from the same IP within a short window — the same signal commercial
// intrusion-detection tools use to flag credential-stuffing/brute-force
// attempts, implemented here as lightweight in-memory tracking
// appropriate for this project's scale.
const failedAuthAttempts = new Map<string, number[]>();
const FAILED_AUTH_WINDOW_MS = 5 * 60 * 1000;
const FAILED_AUTH_THRESHOLD = 8;

app.use((req, res, next) => {
  if (req.path === "/auth/login" || req.path === "/auth/signup") {
    const ip = req.ip ?? "unknown";
    res.on("finish", () => {
      if (res.statusCode === 401 || res.statusCode === 409) {
        const now = Date.now();
        const attempts = (failedAuthAttempts.get(ip) ?? []).filter((t) => now - t < FAILED_AUTH_WINDOW_MS);
        attempts.push(now);
        failedAuthAttempts.set(ip, attempts);
        if (attempts.length >= FAILED_AUTH_THRESHOLD) {
          console.warn(`[security] Possible credential-stuffing/brute-force pattern from ${ip}: ${attempts.length} failed auth attempts in the last 5 minutes.`);
        }
      }
    });
  }
  next();
});

// Protects against any single client (or a burst across many clients)
// overwhelming the AI service / LLM provider. Chat gets its own tighter
// limit since it's the most expensive endpoint (embedding search + LLM
// call). Tune these numbers against your actual Groq/Qdrant rate limits
// before a real public launch.
// Per viewer device (X-Viewer-Id) when the browser sends one, else per IP
// — see clientKey in lib.ts.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: clientKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down and try again shortly." },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: clientKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "This twin is getting a lot of questions right now — try again in a moment." },
});

// Brute-force protection for sign-in/sign-up: 10 failed attempts per IP
// per 15 minutes (successful logins don't count against the limit).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
});

// Video generation calls a paid API (Replicate): cap it so one account
// can't run up the bill.
const videoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Video generation limit reached — try again in an hour." },
});

// Ceiling per IP, so a client can't dodge the per-device limits by
// sending a fresh random X-Viewer-Id on every request. High enough for
// hundreds of real viewers sharing one mobile-carrier IP.
const ipCeiling = rateLimit({
  windowMs: 60 * 1000,
  limit: 1200,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "Too many requests from this network — please try again shortly." },
});

app.use(ipCeiling);
app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth/login", authLimiter);
app.use("/auth/signup", authLimiter);
app.use("/auth", authRoutes);
app.use("/twins", twinRoutes);
app.use("/chat", chatLimiter, chatRoutes);
app.use("/video/generate", videoLimiter);
app.use("/video", videoRoutes);

// Unknown routes get a JSON 404 (instead of Express's HTML page), so the
// frontend's `err.response.data.error` handling works uniformly.
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Malformed / oversized JSON bodies are client errors, not crashes.
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`YouTwin api-service (M5) listening on :${PORT}`);
});
