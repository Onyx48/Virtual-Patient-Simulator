/**
 * Login sessions: a short access token (JWT, kept in the browser's memory only) plus a
 * long refresh token (random, in an httpOnly cookie that page scripts cannot read).
 *
 *   ACCESS_TOKEN_TTL    default 15m   sent as "Authorization: Bearer" on every API call
 *   REFRESH_TOKEN_DAYS  default 90    cookie lifetime; renewed on every refresh, so it
 *                                     only runs out after 90 days without using the app
 *
 * POST /api/auth/refresh swaps the cookie for a new access token and a new cookie
 * (rotation). A refresh token presented again after it was rotated means it was copied,
 * so every session of that user is cancelled, except within a short grace window that
 * covers two tabs refreshing at the same moment.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/refreshTokenModel.js";
import { isProd } from "./appEnv.js";

export const REFRESH_COOKIE = "vps_rt";
const DAYS = Number(process.env.REFRESH_TOKEN_DAYS) || 90;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const GRACE_MS = 30 * 1000;

const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/api/auth", // only sent to refresh/logout, never to the rest of the API
  maxAge: DAYS * 24 * 60 * 60 * 1000,
});

export const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });

/** Reads the refresh cookie without needing cookie-parser. */
export const readRefreshCookie = (req) => {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === REFRESH_COOKIE) return decodeURIComponent(v.join("="));
  }
  return "";
};

const newRow = async (userId, req) => {
  const token = crypto.randomBytes(48).toString("base64url");
  await RefreshToken.create({
    user: userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + DAYS * 864e5),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
  });
  return token;
};

/** Starts a new browser session: sets the refresh cookie. */
export const issueRefreshToken = async (res, userId, req) => {
  res.cookie(REFRESH_COOKIE, await newRow(userId, req), cookieOptions());
};

export const clearRefreshCookie = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
};

/** Password change or reset: cancels every session of the user, on every device. */
export const revokeAllForUser = (userId) => RefreshToken.deleteMany({ user: userId });

/**
 * Validates and rotates the cookie's token. Resolves to the user id, or null when the
 * session is invalid (the caller then clears the cookie and answers 401).
 */
export const rotateRefreshToken = async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) return null;
  const row = await RefreshToken.findOne({ tokenHash: hash(token) });
  if (!row || row.expiresAt < new Date()) return null;

  if (row.revokedAt) {
    // Another tab just rotated it: the browser already holds the new cookie, so only
    // hand out an access token. Any later reuse is treated as a stolen token.
    if (row.replacedBy && Date.now() - row.revokedAt.getTime() < GRACE_MS) return row.user;
    await revokeAllForUser(row.user);
    console.warn(`[AUTH] refresh token reused for user ${row.user}; all sessions cancelled`);
    return null;
  }

  const next = await newRow(row.user, req);
  row.revokedAt = new Date();
  row.replacedBy = hash(next);
  await row.save();
  res.cookie(REFRESH_COOKIE, next, cookieOptions());
  return row.user;
};

/** Logout: cancels this browser's session only. */
export const revokeRefreshToken = async (req) => {
  const token = readRefreshCookie(req);
  if (token) await RefreshToken.deleteOne({ tokenHash: hash(token) });
};
