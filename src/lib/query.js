// TanStack Query: one client for the app, a GET hook on our axios setup, and NDJSON streaming.
import axios from "axios";
import { useCallback } from "react";
import { QueryClient, useQuery, useQueryClient, keepPreviousData, experimental_streamedQuery as streamedQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "./utils.js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // revisiting a page within 30 s shows it at once, no refetch
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Keys carry the signed-in user, so one person's cached data is never shown to another.
export const who = () => { try { return JSON.parse(localStorage.getItem("currentUser"))?._id || "anon"; } catch { return "anon"; } };

export const apiGet = (url, params, signal) => axios.get(url, { ...getAuthHeaders(), params, signal }).then((r) => r.data);

/** GET with caching: const { data, isPending } = useApi("/api/x", { params }). */
export function useApi(url, { params, enabled = true, keep = false, select, staleTime } = {}) {
  return useQuery({
    queryKey: [who(), url, params || null],
    queryFn: ({ signal }) => apiGet(url, params, signal),
    enabled: enabled && !!url,
    placeholderData: keep ? keepPreviousData : undefined,
    select,
    ...(staleTime != null && { staleTime }),
  });
}

/** Lines of an NDJSON response, parsed, as they arrive. */
export async function* ndjson(url, signal) {
  const base = axios.defaults.baseURL || "";
  const auth = getAuthHeaders()?.headers?.Authorization || axios.defaults.headers.common?.Authorization;
  const res = await fetch(`${base}${url}`, { headers: auth ? { Authorization: auth } : {}, credentials: "include", signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buf.trim()) yield JSON.parse(buf);
}

/**
 * A streamed GET (TanStack Query's streamedQuery): each NDJSON line is folded into one value with
 * `reducer`, so the page renders the first lines while the rest is still coming.
 */
export function useStreamedApi(url, { reducer, initialValue, enabled = true } = {}) {
  return useQuery({
    queryKey: [who(), "stream", url],
    queryFn: streamedQuery({ streamFn: ({ signal }) => ndjson(url, signal), reducer, initialValue }),
    enabled,
  });
}

// Any successful change (POST/PUT/PATCH/DELETE) marks every cached GET stale, so a list never
// shows what was there before a save. Pages on screen refetch in the background.
axios.interceptors.response.use((res) => {
  if (res?.config?.method && res.config.method.toLowerCase() !== "get") queryClient.invalidateQueries();
  return res;
});

/** The data or null while loading (fallback on error): drop-in for useState + useEffect(axios.get). */
export function useData(url, { params, fallback = null, enabled = true, select } = {}) {
  const q = useApi(url, { params, enabled, select });
  return q.isError ? fallback : (q.data ?? null);
}

/**
 * Like useState for server data, but held in the TanStack cache:
 *   const [d, setD, refetch, q] = useCached(`/api/groups/${id}/overview`);
 * setD edits the cached copy (after a save), refetch reloads it. d is null while loading,
 * `fallback` on error.
 */
export function useCached(url, { params, enabled = true, fallback = null, keep = false } = {}) {
  const qc = useQueryClient();
  const key = [who(), url, params || null];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => apiGet(url, params, signal), enabled: enabled && !!url, placeholderData: keep ? keepPreviousData : undefined });
  const keyStr = JSON.stringify(key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useCallback((v) => qc.setQueryData(JSON.parse(keyStr), (old) => (typeof v === "function" ? v(old) : v)), [qc, keyStr]);
  return [q.isError ? fallback : (q.data ?? null), set, q.refetch, q];
}

/** A one-off read inside an event handler, through the cache (reuses fresh data, dedupes). */
export const fetchCached = (url, params) => queryClient.fetchQuery({ queryKey: [who(), url, params || null], queryFn: ({ signal }) => apiGet(url, params, signal) });
