import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { aiService, requireAuth, AuthedRequest, handleDbError } from "../lib";

const router = Router();

const createTwinSchema = z.object({
  channelId: z.string().optional(),
  videoUrls: z.array(z.string()).optional(),
  useSampleData: z.boolean().optional().default(false),
});

/**
 * POST /twins   (authed — "Connect channel" -> "Twin trains itself" step)
 * Creates a Twin row and kicks off the M1-M3 ingestion pipeline in the
 * AI service. Returns immediately; the frontend polls /twins/:id/status
 * for the progress ring shown in the dashboard mockup.
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createTwinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { channelId, videoUrls, useSampleData } = parsed.data;

  let creator, twin;
  try {
    creator = await prisma.creator.findUniqueOrThrow({ where: { id: req.creatorId } });
    twin = await prisma.twin.create({
      data: { creatorId: creator.id, channelId, status: "training" },
    });
  } catch (err) {
    return handleDbError(err, res, "Couldn't start training. Try again.");
  }

  try {
    await aiService.post(
      `/ingest?creator_name=${encodeURIComponent(creator.displayName)}`,
      { twin_id: twin.id, channel_id: channelId, video_urls: videoUrls, use_sample_data: useSampleData }
    );
  } catch (err) {
    try {
      await prisma.twin.update({ where: { id: twin.id }, data: { status: "error" } });
    } catch {
      /* best effort — the ingest failure below is the important error to report */
    }
    return res.status(502).json({ error: "Failed to start training on the AI service" });
  }

  res.status(201).json({ twinId: twin.id, shareUrl: `youtwin.ai/${creator.handle}` });
});

/**
 * GET /twins/:id/status   (authed — polled by the "68% training" progress ring)
 */
router.get("/:id/status", requireAuth, async (req, res) => {
  try {
    const { data } = await aiService.get(`/ingest/status/${req.params.id}`);
    if (data.stage === "ready") {
      await prisma.twin.update({ where: { id: req.params.id }, data: { status: "ready" } });
    }
    res.json(data);
  } catch (err) {
    if (String(err).includes("Can't reach database")) {
      return handleDbError(err, res, "Couldn't check training status. Try again.");
    }
    res.status(404).json({ error: "No training job found for this twin" });
  }
});

/**
 * GET /twins/:id/persona   (authed — "Review persona" screen)
 */
router.get("/:id/persona", requireAuth, async (req, res) => {
  try {
    const { data } = await aiService.get(`/persona/${req.params.id}`);
    res.json(data);
  } catch {
    res.status(404).json({ error: "Persona not ready yet" });
  }
});

const toggleSchema = z.object({
  toneMatch: z.boolean(),
  guardrails: z.boolean(),
});

/**
 * PATCH /twins/:id/persona   (authed — Tone match / Guardrails toggles)
 */
router.patch("/:id/persona", requireAuth, async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { toneMatch, guardrails } = parsed.data;

  try {
    await prisma.twin.update({
      where: { id: req.params.id },
      data: { toneMatch, guardrails },
    });
  } catch (err) {
    return handleDbError(err, res, "Couldn't save those settings. Try again.");
  }

  try {
    const { data } = await aiService.patch(
      `/persona/${req.params.id}?tone_match_enabled=${toneMatch}&guardrails_enabled=${guardrails}`
    );
    res.json(data);
  } catch {
    res.status(502).json({ error: "Couldn't reach the AI service to update the persona." });
  }
});

/**
 * GET /twins/by-handle/:handle   (PUBLIC, no auth — resolves youtwin.ai/<handle>
 * to a twin id for the viewer chat page)
 */
router.get("/by-handle/:handle", async (req, res) => {
  try {
    const creator = await prisma.creator.findUnique({
      where: { handle: req.params.handle },
      include: { twins: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!creator || creator.twins.length === 0) {
      return res.status(404).json({ error: "No published twin at this link" });
    }

    const twin = creator.twins[0];
    res.json({
      twinId: twin.id,
      creatorName: creator.displayName,
      status: twin.status,
    });
  } catch (err) {
    handleDbError(err, res, "Couldn't load this twin. Try again.");
  }
});

/**
 * GET /twins/:id/analytics   (authed — creator-only)
 * Real insight from data already being collected on every chat turn —
 * no new external service, just aggregating the existing Message table.
 */
router.get("/:id/analytics", requireAuth, async (req, res) => {
  try {
    const twinMessages = await prisma.message.findMany({
      where: { twinId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    const viewerQuestions = twinMessages.filter((m) => m.role === "viewer");
    const twinAnswers = twinMessages.filter((m) => m.role === "twin");
    const totalConversations = viewerQuestions.length;
    const groundedCount = twinAnswers.filter((m) => m.grounded).length;
    const refusedCount = twinAnswers.length - groundedCount;
    const groundedRate = twinAnswers.length > 0 ? groundedCount / twinAnswers.length : 0;
    const avgConfidence =
      twinAnswers.length > 0
        ? twinAnswers.reduce((sum, m) => sum + m.confidence, 0) / twinAnswers.length
        : 0;

    // Most frequently asked exact questions — a simple, honest metric
    // (no fuzzy clustering) built entirely from real logged data.
    const counts = new Map<string, number>();
    for (const q of viewerQuestions) {
      const key = q.content.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const topQuestions = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([content, count]) => ({ content, count }));

    // Last 14 days of conversation volume, for a simple trend chart.
    const dailyCounts = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyCounts.set(d.toISOString().slice(0, 10), 0);
    }
    for (const q of viewerQuestions) {
      const key = q.createdAt.toISOString().slice(0, 10);
      if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
    }

    res.json({
      totalConversations,
      groundedCount,
      refusedCount,
      groundedRate,
      avgConfidence,
      topQuestions,
      dailyCounts: [...dailyCounts.entries()].map(([date, count]) => ({ date, count })),
    });
  } catch (err) {
    handleDbError(err, res, "Couldn't load analytics. Try again.");
  }
});

export default router;
