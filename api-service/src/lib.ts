import axios from "axios";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const aiService = axios.create({
  baseURL: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  timeout: 30_000,
});

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export interface AuthedRequest extends Request {
  creatorId?: string;
}

export function signSession(creatorId: string): string {
  return jwt.sign({ creatorId }, JWT_SECRET, { expiresIn: "30d" });
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
    const payload = jwt.verify(token, JWT_SECRET) as { creatorId: string };
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

export function handleDbError(err: unknown, res: Response, fallbackMessage: string) {
  console.error("Database error:", err);
  if (isDbUnreachableError(err)) {
    return res.status(503).json({
      error: "The database is temporarily unavailable (this can happen right after it wakes up from being idle) — please try again in a few seconds.",
    });
  }
  return res.status(500).json({ error: fallbackMessage });
}
