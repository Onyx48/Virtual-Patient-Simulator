import { getAccessToken } from "./authToken.js";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/*
 * A stored session score as a whole percentage (0-100), or 0 if missing.
 *
 * The simulator's grader writes a fraction in [0, 1], which is what almost every
 * stored session holds. A few legacy rows came from a grader that marked out
 * of 10, and anything above 10 is taken as already being a percentage.
 */
export const toScorePercent = (score) => {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return Math.round(value * 100);
  if (value <= 10) return Math.round(value * 10);
  return Math.min(100, Math.round(value));
};

// An expired token is fine here: the axios interceptor refreshes it and replays the call.
export const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};
