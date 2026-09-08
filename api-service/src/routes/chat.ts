import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { aiService, handleDbError } from "../lib";

const router = Router();

const chatSchema = z.object({
  twinId: z.string(),
  message: z.string().min(1).max(1000),
  language: z.string().max(40).optional(),
});

/**
 * POST /chat   (PUBLIC — no auth, this is the viewer-facing endpoint hit
 * from youtwin.ai/<handle>'s chat box)
 *
 * Proxies to the AI service's RAG endpoint (M4), then serializes the
 * response for the frontend and logs both turns to Postgres — this is
 * the M5 "Response Serialization Module" from the module description
 * slide, wrapping the Python pipeline behind a stable public REST API.
 */
router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { twinId, message, language } = parsed.data;

  let data;
  try {
    ({ data } = await aiService.post("/chat", { twin_id: twinId, message, language: language ?? "English" }));
  } catch (err) {
    console.error("chat proxy failed", err);
    return res.status(502).json({ error: "The twin is unavailable right now, try again shortly." });
  }

  // The AI already generated a real answer at this point — don't let a
  // database hiccup on the logging step throw that answer away. Best
  // effort: log if we can, but always return the answer either way.
  try {
    await prisma.message.createMany({
      data: [
        { twinId, role: "viewer", content: message },
        {
          twinId,
          role: "twin",
          content: data.refused ? data.refusal_reason : data.answer,
          grounded: data.grounded,
          confidence: data.confidence,
        },
      ],
    });
  } catch (err) {
    console.error("chat history logging failed (non-fatal):", err);
  }

  res.json({
    answer: data.refused ? data.refusal_reason : data.answer,
    refused: data.refused,
    grounded: data.grounded,
    confidence: data.confidence,
    citations: data.citations ?? [],
  });
});

/**
 * GET /chat/:twinId/history   (PUBLIC — reloads recent conversation on
 * page refresh)
 */
router.get("/:twinId/history", async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { twinId: req.params.twinId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json(messages);
  } catch (err) {
    handleDbError(err, res, "Couldn't load chat history. Try again.");
  }
});

/**
 * GET /chat/:twinId/moments   (PUBLIC — powers the Topic Explorer on
 * the viewer chat page)
 */
router.get("/:twinId/moments", async (req, res) => {
  try {
    const { data } = await aiService.get(`/moments/${req.params.twinId}`);
    res.json(data);
  } catch (err) {
    console.error("moments fetch failed", err);
    res.status(502).json({ error: "Couldn't load topics right now." });
  }
});

export default router;
