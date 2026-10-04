import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import axios from "axios";
import {
  aiService,
  callAi, cleanViewerName, deviceLabel, handleDbError, isValidId, isViewerId, requireAuth, AuthedRequest,
} from "../lib";

const router = Router();

/**
 * Creates or refreshes this device's viewer profile for a twin (one row
 * per twin + device). Two first requests from the same device can race
 * on the unique (twinId, deviceId) key; the loser simply retries, and
 * then finds the row the winner created.
 */
async function touchViewer(
  twinId: string,
  deviceId: string,
  opts: { name?: string | null; device: string; language?: string; visit?: boolean },
): Promise<{ id: string; name: string }> {
  const run = () =>
    prisma.viewer.upsert({
      where: { twinId_deviceId: { twinId, deviceId } },
      create: {
        twinId,
        deviceId,
        name: opts.name ?? "Viewer",
        device: opts.device,
        ...(opts.language ? { language: opts.language } : {}),
      },
      update: {
        lastSeen: new Date(),
        ...(opts.device ? { device: opts.device } : {}),
        ...(opts.name ? { name: opts.name } : {}),
        ...(opts.language ? { language: opts.language } : {}),
        ...(opts.visit ? { visits: { increment: 1 } } : {}),
      },
      select: { id: true, name: true },
    });
  try {
    return await run();
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return run();
    throw err;
  }
}

const viewerSchema = z.object({
  viewerId: z.string().refine(isViewerId, "Invalid viewer id"),
  name: z.string().max(80),
});

/**
 * POST /chat/:twinId/viewer   (PUBLIC — the name step of the share link)
 * Registers (or renames) the person on this device before they chat, so
 * the creator sees every visitor by name in Analytics, even those who
 * leave without asking anything.
 */
router.post("/:twinId/viewer", async (req, res) => {
  const { twinId } = req.params;
  if (!isValidId(twinId)) return res.status(404).json({ error: "Twin not found" });
  const parsed = viewerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Something went wrong — reload the page and try again." });
  const name = cleanViewerName(parsed.data.name);
  if (!name) return res.status(400).json({ error: "Use 2–40 letters for your name (no links)." });
  try {
    const twin = await prisma.twin.findUnique({ where: { id: twinId }, select: { id: true } });
    if (!twin) return res.status(404).json({ error: "Twin not found" });
    const viewer = await touchViewer(twinId, parsed.data.viewerId.toLowerCase(), {
      name,
      device: deviceLabel(req.get("user-agent")),
      visit: true,
    });
    res.json({ name: viewer.name });
  } catch (err) {
    handleDbError(err, res, "Couldn't save your name. Try again.");
  }
});

const chatSchema = z.object({
  twinId: z.string().refine(isValidId, "Unknown twin"),
  message: z.string().trim().min(1, "Type a message first").max(1000, "Keep questions under 1000 characters"),
  language: z.string().max(40).optional(),
  // Playtime context (browser sidebar / ?v=&t= deep link): which video
  // the viewer is watching and where. Both optional.
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid video id").optional(),
  atSeconds: z.number().int().min(0).max(86400).optional(),
  // This viewer's last few turns, so follow-ups ("how much was it?") are
  // understood. Sent by the chat page; never read from other viewers' logs.
  history: z
    .array(z.object({ role: z.enum(["viewer", "twin"]), content: z.string().max(2000) }))
    .max(8)
    .optional(),
  // Who is asking: the device id + the name from the share link's name
  // step (frontend lib/viewer.ts). Optional, so older clients still work.
  viewerId: z.string().refine(isViewerId, "Invalid viewer id").optional(),
  viewerName: z.string().max(80).optional(),
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
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
  }
  const { twinId, message, language, videoId, atSeconds, history, viewerId } = parsed.data;
  const viewerName = cleanViewerName(parsed.data.viewerName);

  // Best-effort lookup of the creator's name, so ai-service can rebuild a
  // lost persona correctly (see ai-service/app/recovery.py). A database
  // hiccup here must never block the viewer's chat.
  let creatorName: string | undefined;
  try {
    const twin = await prisma.twin.findUnique({
      where: { id: twinId },
      select: { creator: { select: { displayName: true } } },
    });
    creatorName = twin?.creator?.displayName;
  } catch {
    /* non-fatal */
  }

  let data;
  try {
    ({ data } = await callAi(() => aiService.post("/chat", {
      twin_id: twinId,
      message,
      language: language ?? "English",
      creator_name: creatorName,
      video_id: videoId,
      at_seconds: videoId ? atSeconds : undefined,
      history: history?.filter((t) => t.content.trim()).slice(-6),
      viewer_name: viewerName ?? undefined,
    })));
  } catch (err) {
    // A twin that hasn't finished (or whose training data expired) is a
    // 404 from ai-service — tell the viewer that, not "unavailable".
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return res.status(404).json({ error: "This twin isn't ready to chat yet." });
    }
    console.error("chat proxy failed", axios.isAxiosError(err) ? err.message : err);
    return res.status(502).json({ error: "The twin is unavailable right now, try again shortly." });
  }

  const answer: string =
    (data.refused ? data.refusal_reason : data.answer) || "I'm not sure — I haven't covered that in a video yet.";

  // Small talk ("hi", "thanks") is neither an answer nor a refusal: it is
  // not logged, so it can't skew the creator's grounded-rate analytics.
  const smallTalk = !data.refused && !data.grounded;

  // The AI already generated a real answer at this point — don't let a
  // database hiccup on the logging step throw that answer away. Best
  // effort: log if we can, but always return the answer either way.
  try {
    // Attach both turns to this device's viewer profile (creating it if
    // the viewer skipped the name step, e.g. an old cached page).
    const viewer = viewerId
      ? await touchViewer(twinId, viewerId.toLowerCase(), {
          name: viewerName,
          device: deviceLabel(req.get("user-agent")),
          language: language ?? "English",
        })
      : null;
    if (!smallTalk) await prisma.message.createMany({
      data: [
        { twinId, role: "viewer", content: message, viewerId: viewer?.id ?? null },
        {
          twinId,
          role: "twin",
          content: answer,
          grounded: !!data.grounded,
          confidence: Number(data.confidence) || 0,
          viewerId: viewer?.id ?? null,
        },
      ],
    });
  } catch (err) {
    console.error("chat history logging failed (non-fatal):", err);
  }

  res.json({
    answer,
    refused: data.refused,
    grounded: data.grounded,
    confidence: data.confidence,
    citations: data.citations ?? [],
  });
});

/**
 * GET /chat/:twinId/history   (authed — the twin's OWNER only)
 * Every viewer's questions are logged here. This used to be public, so
 * anyone holding a share link (the twin id is in every video
 * description) could read all other viewers' conversations.
 */
router.get("/:twinId/history", requireAuth, async (req: AuthedRequest, res) => {
  if (!isValidId(req.params.twinId)) return res.status(404).json({ error: "Twin not found" });
  try {
    const twin = await prisma.twin.findUnique({ where: { id: req.params.twinId }, select: { creatorId: true } });
    if (!twin || twin.creatorId !== req.creatorId) return res.status(404).json({ error: "Twin not found" });
    const messages = await prisma.message.findMany({
      where: { twinId: req.params.twinId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(messages.reverse());
  } catch (err) {
    handleDbError(err, res, "Couldn't load chat history. Try again.");
  }
});

/**
 * GET /chat/:twinId/moments   (PUBLIC — powers the Topic Explorer on
 * the viewer chat page)
 */
router.get("/:twinId/moments", async (req, res) => {
  if (!isValidId(req.params.twinId)) return res.json({ moments: [] });
  try {
    const { data } = await aiService.get(`/moments/${encodeURIComponent(req.params.twinId)}`);
    res.json(data);
  } catch (err) {
    console.error("moments fetch failed", err);
    res.status(502).json({ error: "Couldn't load topics right now." });
  }
});

export default router;
