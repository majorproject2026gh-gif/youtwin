import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import twinRoutes from "./routes/twin";
import chatRoutes from "./routes/chat";
import videoRoutes from "./routes/video";

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

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

// Protects against any single client (or a burst across many clients)
// overwhelming the AI service / LLM provider. Chat gets its own tighter
// limit since it's the most expensive endpoint (embedding search + LLM
// call). Tune these numbers against your actual Groq/Qdrant rate limits
// before a real public launch.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down and try again shortly." },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "This twin is getting a lot of questions right now — try again in a moment." },
});

app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/twins", twinRoutes);
app.use("/chat", chatLimiter, chatRoutes);
app.use("/video", videoRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`YouTwin api-service (M5) listening on :${PORT}`);
});
