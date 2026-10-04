import { Router } from "express";
import axios from "axios";
import { z } from "zod";
import { prisma } from "../db";
import { Response, NextFunction } from "express";
import { aiService, requireAuth, AuthedRequest, handleDbError, isValidId } from "../lib";

const router = Router();

/**
 * Every /twins/:id/* creator route used to check only that SOME creator
 * was signed in — not that the twin belonged to them. Any logged-in
 * account could read another creator's analytics or flip their persona
 * toggles just by knowing a twin id (which is public in every share
 * link). This guard enforces ownership.
 */
async function requireOwnTwin(req: AuthedRequest, res: Response, next: NextFunction) {
  const id = req.params.id;
  if (!isValidId(id)) return res.status(404).json({ error: "Twin not found" });
  try {
    const twin = await prisma.twin.findUnique({
      where: { id },
      select: { creatorId: true, creator: { select: { displayName: true } } },
    });
    if (!twin || twin.creatorId !== req.creatorId) {
      return res.status(404).json({ error: "Twin not found" });
    }
    res.locals.creatorName = twin.creator?.displayName ?? "";
    next();
  } catch (err) {
    handleDbError(err, res, "Couldn't load this twin. Try again.");
  }
}

const createTwinSchema = z.object({
  channelId: z.string().max(300).optional(),
  videoUrls: z.array(z.string().max(300)).max(20).optional(),
  useSampleData: z.boolean().optional().default(false),
});

// Public + list routes are registered BEFORE the "/:id/..." routes so a
// creator whose handle happens to be "status", "persona" or "analytics"
// can't be shadowed by an authed route.
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
 * GET /twins/by-id/:twinId   (PUBLIC — resolves youtwin.ai/twin/<twinId>)
 *
 * Unlike /by-handle, this resolves a SPECIFIC twin directly by its own
 * id rather than "whichever twin this creator trained most recently".
 * That distinction matters for creators with multiple videos: a link
 * tied to the creator's handle silently starts pointing at a different
 * twin every time they retrain, breaking any link already pasted into
 * an older video's description. A link tied to the twin's own id stays
 * correct for that specific video forever, regardless of what the
 * creator trains afterward.
 */
router.get("/by-id/:twinId", async (req, res) => {
  if (!isValidId(req.params.twinId)) {
    return res.status(404).json({ error: "No twin found at this link" });
  }
  try {
    const twin = await prisma.twin.findUnique({
      where: { id: req.params.twinId },
      include: { creator: true },
    });
    if (!twin) {
      return res.status(404).json({ error: "No twin found at this link" });
    }
    res.json({
      twinId: twin.id,
      creatorName: twin.creator.displayName,
      status: twin.status,
    });
  } catch (err) {
    handleDbError(err, res, "Couldn't load this twin. Try again.");
  }
});

/**
 * GET /twins/mine   (authed — creator-only)
 * Lists every twin this creator has ever trained, newest first — powers
 * the "My Twins" page so a creator with multiple videos can find and
 * copy the correct per-video link for each one, even after training
 * several more since.
 */
router.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const twins = await prisma.twin.findMany({
      where: { creatorId: req.creatorId },
      orderBy: { createdAt: "desc" },
      select: { id: true, channelId: true, status: true, createdAt: true },
    });
    res.json({ twins });
  } catch (err) {
    handleDbError(err, res, "Couldn't load your twins. Try again.");
  }
});

// ---------------------------------------------------------------- delete

/**
 * Deletes twins (DB rows + their chat logs) in one transaction, then asks
 * ai-service to purge the vectors, persona, status and cached answers.
 * The purge is best-effort: the database is the source of truth, and an
 * orphaned vector collection is unreachable once the twin row is gone.
 */
async function deleteTwins(creatorId: string, ids: string[]) {
  if (ids.length === 0) return { deleted: 0, ids: [] as string[], cleanupFailed: false };
  const [, , result] = await prisma.$transaction([
    prisma.message.deleteMany({ where: { twinId: { in: ids } } }),
    prisma.viewer.deleteMany({ where: { twinId: { in: ids } } }),
    prisma.twin.deleteMany({ where: { id: { in: ids }, creatorId } }),
  ]);
  let cleanupFailed = false;
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const { data } = await aiService.post("/twins/purge", { twin_ids: ids.slice(i, i + 100) });
      if (data?.failed?.length) cleanupFailed = true;
    } catch (err) {
      cleanupFailed = true;
      console.error("ai-service purge failed (DB rows already deleted):", axios.isAxiosError(err) ? err.message : err);
    }
  }
  return { deleted: result.count, ids, cleanupFailed };
}

// A twin still "training" after this long is treated as stuck.
const STUCK_AFTER_MS = 30 * 60 * 1000;

const bulkDeleteSchema = z.union([
  z.object({ scope: z.enum(["unfinished", "all"]) }),
  z.object({ ids: z.array(z.string().refine(isValidId)).min(1).max(500) }),
]);

/**
 * POST /twins/bulk-delete   (authed)
 *   { scope: "unfinished" }  failed twins + twins stuck in training > 30 min
 *   { scope: "all" }         every twin this creator owns
 *   { ids: [...] }           specific twins (only the caller's own are touched)
 */
router.post("/bulk-delete", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose which twins to delete." });
  try {
    const mine: { id: string; status: string; createdAt: Date }[] = await prisma.twin.findMany({
      where: { creatorId: req.creatorId },
      select: { id: true, status: true, createdAt: true },
    });
    let ids: string[];
    if ("ids" in parsed.data) {
      const wanted = new Set(parsed.data.ids);
      ids = mine.filter((t) => wanted.has(t.id)).map((t) => t.id);
    } else if (parsed.data.scope === "all") {
      ids = mine.map((t) => t.id);
    } else {
      const cutoff = Date.now() - STUCK_AFTER_MS;
      ids = mine
        .filter((t) => t.status !== "ready" && (t.status === "error" || t.createdAt.getTime() < cutoff))
        .map((t) => t.id);
    }
    res.json(await deleteTwins(req.creatorId!, ids));
  } catch (err) {
    handleDbError(err, res, "Couldn't delete twins. Try again.");
  }
});

/**
 * DELETE /twins/:id   (authed, owner only)
 */
router.delete("/:id", requireAuth, requireOwnTwin, async (req: AuthedRequest, res) => {
  try {
    res.json(await deleteTwins(req.creatorId!, [req.params.id]));
  } catch (err) {
    handleDbError(err, res, "Couldn't delete this twin. Try again.");
  }
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
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const channelId = parsed.data.channelId?.trim() || undefined;
  const videoUrls = parsed.data.videoUrls?.map((u) => u.trim()).filter(Boolean);
  const useSampleData = parsed.data.useSampleData || (!channelId && !videoUrls?.length);

  let creator, twin;
  try {
    creator = await prisma.creator.findUniqueOrThrow({ where: { id: req.creatorId } });
    twin = await prisma.twin.create({
      data: { creatorId: creator.id, channelId: channelId ?? videoUrls?.[0] ?? null, status: "training" },
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
    // This was a silent catch — swallowed the real cause (connection
    // refused, a 4xx/5xx from ai-service, a timeout, etc.) and always
    // reported the same generic message, making this failure mode
    // undiagnosable from the api-service side. Log what axios actually
    // saw: for an HTTP error response, that's err.response.status/data;
    // for a network-level failure (wrong port, service not running),
    // there's no response at all and err.message has the real reason
    // (e.g. "ECONNREFUSED").
    if (axios.isAxiosError(err)) {
      console.error(
        "ingest call to ai-service failed:",
        err.response ? `HTTP ${err.response.status} — ${JSON.stringify(err.response.data)}` : err.message
      );
    } else {
      console.error("ingest call to ai-service failed:", err);
    }
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
router.get("/:id/status", requireAuth, requireOwnTwin, async (req, res) => {
  try {
    // creator_name lets ai-service rebuild a lost persona with the right name.
    const { data } = await aiService.get(`/ingest/status/${req.params.id}`, {
      params: { creator_name: res.locals.creatorName || undefined },
    });
    // Keep the Twin row in sync with the pipeline's terminal states —
    // previously only "ready" was written back, so a failed run stayed
    // "training" forever on the My Twins page.
    if (data.stage === "ready" || data.stage === "error") {
      await prisma.twin
        .updateMany({ where: { id: req.params.id, NOT: { status: data.stage } }, data: { status: data.stage } })
        .catch((e: unknown) => console.error("twin status sync failed (non-fatal):", e));
    }
    res.json(data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return res.status(404).json({ error: "No training job found for this twin" });
    }
    console.error("status check failed:", axios.isAxiosError(err) ? err.message : err);
    res.status(502).json({ error: "Couldn't reach the AI service to check training status." });
  }
});

/**
 * GET /twins/:id/persona   (authed — "Review persona" screen)
 */
router.get("/:id/persona", requireAuth, requireOwnTwin, async (req, res) => {
  try {
    const { data } = await aiService.get(`/persona/${req.params.id}`, {
      params: { creator_name: res.locals.creatorName || undefined },
    });
    res.json(data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return res.status(404).json({ error: "Persona not ready yet" });
    }
    res.status(502).json({ error: "Couldn't reach the AI service to load the persona." });
  }
});

/**
 * GET /twins/:id/persona/definition   (authed, owner only)
 * The M2 persona definition file (spaCy profile + LlamaIndex Document),
 * downloaded from the Review screen.
 */
router.get("/:id/persona/definition", requireAuth, requireOwnTwin, async (req, res) => {
  try {
    const { data } = await aiService.get(`/persona/${req.params.id}/definition`, {
      params: { creator_name: res.locals.creatorName || undefined },
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return res.status(404).json({ error: "Persona not ready yet" });
    }
    res.status(502).json({ error: "Couldn't reach the AI service to build the persona file." });
  }
});

const toggleSchema = z.object({
  toneMatch: z.boolean(),
  guardrails: z.boolean(),
});

/**
 * PATCH /twins/:id/persona   (authed — Tone match / Guardrails toggles)
 */
router.patch("/:id/persona", requireAuth, requireOwnTwin, async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "toneMatch and guardrails must be true/false" });
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
 * GET /twins/:id/analytics   (authed — creator-only)
 * Real insight from data already being collected on every chat turn —
 * no new external service, just aggregating the existing Message table.
 */
router.get("/:id/analytics", requireAuth, requireOwnTwin, async (req, res) => {
  try {
    const twinMessages: { role: string; content: string; grounded: boolean; confidence: number; createdAt: Date }[] =
      await prisma.message.findMany({
        where: { twinId: req.params.id },
        orderBy: { createdAt: "desc" },
        select: { role: true, content: true, grounded: true, confidence: true, createdAt: true },
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

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [uniqueViewers, activeViewers24h] = await Promise.all([
      prisma.viewer.count({ where: { twinId: req.params.id } }),
      prisma.viewer.count({ where: { twinId: req.params.id, lastSeen: { gte: since } } }),
    ]);

    res.json({
      uniqueViewers,
      activeViewers24h,
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

// ---------------------------------------------------------------- viewers

interface ViewerRow {
  id: string;
  name: string;
  device: string;
  language: string;
  visits: number;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * GET /twins/:id/viewers   (authed — creator-only)
 * One small profile per person who opened this twin's link: name, device,
 * visits, first/last seen, questions asked, answered vs refused, and
 * their latest question. Newest activity first, up to 500 viewers.
 */
router.get("/:id/viewers", requireAuth, requireOwnTwin, async (req, res) => {
  const twinId = req.params.id;
  try {
    const viewers: ViewerRow[] = await prisma.viewer.findMany({
      where: { twinId },
      orderBy: { lastSeen: "desc" },
      take: 500,
      select: { id: true, name: true, device: true, language: true, visits: true, firstSeen: true, lastSeen: true },
    });
    const counts: { viewerId: string | null; role: string; grounded: boolean; _count: { _all: number } }[] =
      await prisma.message.groupBy({
        by: ["viewerId", "role", "grounded"],
        where: { twinId, viewerId: { not: null } },
        _count: { _all: true },
      });
    const latest: { viewerId: string | null; content: string; createdAt: Date }[] = await prisma.message.findMany({
      where: { twinId, role: "viewer", viewerId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: { viewerId: true, content: true, createdAt: true },
    });

    const stats = new Map<string, { questions: number; answered: number; refused: number }>();
    for (const c of counts) {
      if (!c.viewerId) continue;
      const s = stats.get(c.viewerId) ?? { questions: 0, answered: 0, refused: 0 };
      if (c.role === "viewer") s.questions += c._count._all;
      else if (c.grounded) s.answered += c._count._all;
      else s.refused += c._count._all;
      stats.set(c.viewerId, s);
    }
    const lastQuestion = new Map<string, string>();
    for (const m of latest) {
      if (m.viewerId && !lastQuestion.has(m.viewerId)) lastQuestion.set(m.viewerId, m.content);
    }

    const since = Date.now() - 24 * 60 * 60 * 1000;
    res.json({
      total: viewers.length,
      activeToday: viewers.filter((v) => v.lastSeen.getTime() >= since).length,
      viewers: viewers.map((v) => ({
        id: v.id,
        tag: v.id.slice(0, 4),
        name: v.name,
        device: v.device,
        language: v.language,
        visits: v.visits,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        ...(stats.get(v.id) ?? { questions: 0, answered: 0, refused: 0 }),
        lastQuestion: lastQuestion.get(v.id) ?? null,
      })),
    });
  } catch (err) {
    handleDbError(err, res, "Couldn't load your viewers. Try again.");
  }
});

/**
 * GET /twins/:id/viewers/:viewerId   (authed — creator-only)
 * One viewer's profile and full conversation with the twin, oldest first.
 */
router.get("/:id/viewers/:viewerId", requireAuth, requireOwnTwin, async (req, res) => {
  const { id: twinId, viewerId } = req.params;
  if (!isValidId(viewerId)) return res.status(404).json({ error: "Viewer not found" });
  try {
    const viewer = await prisma.viewer.findUnique({
      where: { id: viewerId },
      select: { id: true, twinId: true, name: true, device: true, language: true, visits: true, firstSeen: true, lastSeen: true },
    });
    if (!viewer || viewer.twinId !== twinId) return res.status(404).json({ error: "Viewer not found" });
    const messages = await prisma.message.findMany({
      where: { twinId, viewerId },
      orderBy: { createdAt: "asc" },
      take: 400,
      select: { role: true, content: true, grounded: true, confidence: true, createdAt: true },
    });
    const { twinId: _omit, ...profile } = viewer;
    res.json({ viewer: { ...profile, tag: viewer.id.slice(0, 4) }, messages });
  } catch (err) {
    handleDbError(err, res, "Couldn't load this conversation. Try again.");
  }
});

export default router;
