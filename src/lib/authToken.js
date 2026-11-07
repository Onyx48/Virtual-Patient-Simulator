/**
 * The access token lives only in this module's memory, never in localStorage, so a
 * script injected into the page cannot read a long-lived credential. The long-lived
 * part is the refresh token, an httpOnly cookie the browser sends to /api/auth/refresh.
 *
 * Reloading the page loses the access token; AuthProvider gets a new one from
 * /api/auth/refresh on startup, and the axios interceptor does the same on any 401.
 */
import axios from "axios";

// The refresh cookie must travel with requests to the API on :5001.
axios.defaults.withCredentials = true;

let accessToken = "";
let refreshing = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || "";
  if (accessToken) axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  else delete axios.defaults.headers.common.Authorization;
};

/**
 * Gets a new access token from the refresh cookie. Concurrent callers share one request,
 * so ten 401s at once trigger a single refresh. Resolves to the user (with .token) or null.
 */
export const refreshSession = () => {
  refreshing ||= axios
    .post("/api/auth/refresh", {}, { _skipAuthRefresh: true })
    .then(({ data }) => {
      setAccessToken(data.token);
      return data;
    })
    .catch(() => {
      setAccessToken("");
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};
