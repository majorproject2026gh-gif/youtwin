import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db";
import { signSession, slugify, requireAuth, AuthedRequest, isDbUnreachableError, handleDbError } from "../lib";

const router = Router();

// Compared against when no account matches, so a failed login takes the
// same time whether or not the username exists (no timing side-channel).
const DUMMY_HASH = bcrypt.hashSync("youtwin-timing-equalizer", 10);
const BAD_LOGIN = "Incorrect username/mobile number or password.";

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function serializeCreator(c: { id: string; displayName: string; handle: string; email: string | null }) {
  return {
    id: c.id,
    displayName: c.displayName,
    handle: c.handle,
    googleLinked: !!c.email,
  };
}

const signupSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, . and _"),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Enter a valid mobile number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/**
 * POST /auth/signup
 * Real app account creation — username + mobile number + password.
 * This is deliberately separate from the Google account used later to
 * authorize YouTube channel access (see POST /auth/google below).
 */
router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { displayName, username, mobileNumber, password } = parsed.data;

  try {
    const existing = await prisma.creator.findFirst({
      where: { OR: [{ username }, { mobileNumber }] },
    });
    if (existing) {
      return res.status(409).json({
        error:
          existing.username === username
            ? "That username is already taken."
            : "That mobile number is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let handle = slugify(username);
    const handleTaken = await prisma.creator.findUnique({ where: { handle } });
    if (handleTaken) handle = `${handle}${Math.floor(1000 + Math.random() * 9000)}`;

    const creator = await prisma.creator.create({
      data: { displayName, username, mobileNumber, passwordHash, handle },
    });

    const session = signSession(creator.id);
    res.status(201).json({ session, creator: serializeCreator(creator) });
  } catch (err) {
    handleDbError(err, res, "Couldn't create your account. Try again.");
  }
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or mobile number"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * POST /auth/login
 * identifier can be either the username or the mobile number.
 */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { identifier, password } = parsed.data;

  try {
    const creator = await prisma.creator.findFirst({
      where: { OR: [{ username: identifier }, { mobileNumber: identifier }] },
    });
    // One generic message for both cases: distinct "no account" vs
    // "wrong password" errors let anyone discover which usernames and
    // mobile numbers are registered.
    const valid = await bcrypt.compare(password, creator?.passwordHash ?? DUMMY_HASH);
    if (!creator || !valid) {
      return res.status(401).json({ error: BAD_LOGIN });
    }

    const session = signSession(creator.id);
    res.json({ session, creator: serializeCreator(creator) });
  } catch (err) {
    handleDbError(err, res, "Couldn't sign in. Try again.");
  }
});

const googleLinkSchema = z.object({ idToken: z.string().min(1) });

/**
 * POST /auth/google   (requires an existing app session)
 * Links the signed-in Creator's account to a real Google account, purely
 * to authorize YouTube Data API access for their channel. This is NOT
 * how people log into YouTwin — that's /auth/login above.
 */
router.post("/google", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = googleLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "idToken is required" });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      error: "GOOGLE_CLIENT_ID not configured on the server. See api-service/.env.example.",
    });
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const conflict = await prisma.creator.findFirst({
      where: { googleSub: payload.sub, NOT: { id: req.creatorId } },
    });
    if (conflict) {
      return res.status(409).json({ error: "That Google account is already linked to a different YouTwin account." });
    }

    const creator = await prisma.creator.update({
      where: { id: req.creatorId },
      data: { googleSub: payload.sub, email: payload.email },
    });

    res.json({ creator: serializeCreator(creator) });
  } catch (err) {
    if (isDbUnreachableError(err)) {
      return handleDbError(err, res, "Couldn't link that Google account. Try again.");
    }
    console.error("Google account linking failed", err);
    res.status(401).json({ error: "Google authentication failed" });
  }
});

/**
 * POST /auth/google/unlink   (requires an existing app session)
 * Clears the linked Google account so the Connect step will prompt
 * for Google sign-in again. Useful for testing — in production this
 * would typically be an account-settings action.
 */
router.post("/google/unlink", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const creator = await prisma.creator.update({
      where: { id: req.creatorId },
      data: { googleSub: null, email: null },
    });
    res.json({ creator: serializeCreator(creator) });
  } catch (err) {
    handleDbError(err, res, "Couldn't disconnect that Google account. Try again.");
  }
});

/**
 * GET /auth/me   (requires an existing app session)
 * Lets the frontend re-fetch current account state (e.g. googleLinked)
 * without re-parsing a stale localStorage copy.
 */
router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const creator = await prisma.creator.findUnique({ where: { id: req.creatorId } });
    if (!creator) return res.status(404).json({ error: "Account not found" });
    res.json({ creator: serializeCreator(creator) });
  } catch (err) {
    handleDbError(err, res, "Couldn't load your account. Try again.");
  }
});

export default router;
