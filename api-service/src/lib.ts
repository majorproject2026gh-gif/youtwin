import axios from "axios";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const aiService = axios.create({
  baseURL: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  timeout: 30_000,
  // Once ai-service is deployed publicly (see deployment guide), it's no
  // longer protected by simply being unreachable on localhost — anyone
  // could call it directly otherwise, bypassing this service's auth and
  // rate limiting entirely. This shared secret lets ai-service verify a
  // request genuinely came from here.
  headers: process.env.AI_SERVICE_SECRET
    ? { "X-Internal-Secret": process.env.AI_SERVICE_SECRET }
    : {},
});

// A missing JWT_SECRET in production would mean every session is signed
// with a publicly-known key (anyone could forge a login) — refuse to boot
// instead. Local dev keeps the convenience fallback.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production (see api-service/.env.example).");
}
// A short secret can be brute-forced offline from any issued token.
if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET ?? "").length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
// Pin the algorithm on both sides so a token can never be accepted with a
// different (or "none") algorithm than the one we sign with.
const JWT_ALG = "HS256" as const;

export interface AuthedRequest extends Request {
  creatorId?: string;
}

export function signSession(creatorId: string): string {
  return jwt.sign({ creatorId }, JWT_SECRET, { algorithm: JWT_ALG, expiresIn: "30d" });
}

/** Protects creator-only routes (dashboard actions). The public viewer
 * chat page never hits authed routes — matches the journey map where
 * viewers never sign in. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.session;

  if (!token) {
    return res.status(401).json({ error: "Not signed in" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] }) as { creatorId?: string };
    if (!payload?.creatorId) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    req.creatorId = payload.creatorId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/** Slugifies a display name into a unique-ish handle for the public
 * share link (youtwin.ai/<handle>), matching the dashboard mockup. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "creator";
}

/**
 * Neon's free-tier Postgres suspends itself after a period of
 * inactivity and can take a moment to wake back up (or, rarely, drop a
 * connection outright). Left unhandled, a single one of these hiccups
 * used to crash the entire api-service process for every user — every
 * route that touches the database should catch its errors with
 * handleDbError below instead of letting them propagate unguarded.
 */
export function isDbUnreachableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Can't reach database server") ||
    message.includes("Connection terminated") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT")
  );
}

/** Twin ids are UUIDs — reject anything else before it reaches Prisma
 * (a malformed id otherwise surfaces as a confusing 500) or gets
 * interpolated into an ai-service URL. */
export function isValidId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-fA-F-]{8,64}$/.test(id);
}

export function handleDbError(err: unknown, res: Response, fallbackMessage: string) {
  console.error("Database error:", err);
  // Prisma unique-constraint violation (e.g. two signups racing for the
  // same username) — a conflict, not a server failure.
  if ((err as { code?: string })?.code === "P2002") {
    return res.status(409).json({ error: "That value is already in use — try a different one." });
  }
  if (isDbUnreachableError(err)) {
    return res.status(503).json({
      error: "The database is temporarily unavailable (this can happen right after it wakes up from being idle) — please try again in a few seconds.",
    });
  }
  return res.status(500).json({ error: fallbackMessage });
}

// ---------------------------------------------------------------- viewers

/** A viewer's device id: a random v4 UUID the browser keeps in
 * localStorage (frontend lib/viewer.ts). Not a secret — it only groups
 * one device's chats under one profile. */
export const VIEWER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isViewerId(id: unknown): id is string {
  return typeof id === "string" && VIEWER_ID_RE.test(id);
}

/** Display names: letters in any script (Hindi, Marathi...), digits,
 * spaces and . ' - — 2 to 40 characters. Rejects links and emails. */
const NAME_RE = /^[\p{L}\p{M}0-9 .'-]{2,40}$/u;

export function cleanViewerName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return NAME_RE.test(name) && /\p{L}/u.test(name) ? name : null;
}

/** "Android · Chrome" from a user-agent string (best effort, no library). */
export function deviceLabel(ua: string | undefined): string {
  if (!ua) return "";
  const os = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  const browser = /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "";
  return [os, browser].filter(Boolean).join(" · ");
}

/** Rate-limit key: the viewer's device id when the browser sends one
 * (X-Viewer-Id), else the IP. Mobile carriers put many people behind one
 * shared IP, so per-IP limits alone would block a whole city at once. */
export function clientKey(req: Request): string {
  const v = req.get("x-viewer-id");
  return isViewerId(v) ? `viewer:${v.toLowerCase()}` : `ip:${req.ip ?? "unknown"}`;
}
