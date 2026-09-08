import { Router } from "express";
import { z } from "zod";
import { aiService, requireAuth, AuthedRequest } from "../lib";

const router = Router();

const generateSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the video you want in a few words").max(500),
});

/**
 * POST /video/generate   (authed — creator-only)
 * Kicks off AI video generation (Replicate) for the given prompt.
 * Returns immediately with a job id; the frontend polls
 * /video/status/:jobId for progress, mirroring the same pattern used
 * for channel ingestion status.
 */
router.post("/generate", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid prompt" });
  }
  try {
    const { data } = await aiService.post("/video/generate", { prompt: parsed.data.prompt });
    res.status(201).json(data);
  } catch (err) {
    console.error("video generation start failed", err);
    res.status(502).json({ error: "Couldn't start video generation. Is the AI service running?" });
  }
});

/**
 * GET /video/status/:jobId   (authed)
 */
router.get("/status/:jobId", requireAuth, async (req, res) => {
  try {
    const { data } = await aiService.get(`/video/status/${req.params.jobId}`);
    res.json(data);
  } catch {
    res.status(404).json({ error: "No generation job found for this id" });
  }
});

export default router;
