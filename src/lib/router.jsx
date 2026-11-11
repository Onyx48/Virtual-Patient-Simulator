// The app's routing hooks, on TanStack Router (src/router.jsx holds the route tree).
// Same names and call shapes the pages already use, so `navigate("/students?q=x")`,
// `useParams().id`, `useSearchParams()` and `<NavLink className={({isActive}) => …}>` keep working.
import React, { useCallback, useMemo } from "react";
import {
  useNavigate as useTanstackNavigate,
  useParams as useTanstackParams,
  useRouterState,
  useRouter,
  Link as TanstackLink,
  Navigate as TanstackNavigate,
  Outlet,
} from "@tanstack/react-router";

export { Outlet };

/** "/a/b?x=1&y=2" → { to: "/a/b", search: { x: "1", y: "2" } }. Search values stay strings. */
function split(to) {
  const [path, qs = ""] = String(to).split("?");
  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};
  return { to: path || "/", search };
}

/** navigate(to, { replace, state }) or navigate(-1). */
export function useNavigate() {
  const nav = useTanstackNavigate();
  const router = useRouter();
  return useCallback((to, opts = {}) => {
    if (typeof to === "number") { router.history.go(to); return; }
    const { to: path, search } = split(to);
    nav({ to: path, search, replace: !!opts.replace, ...(opts.state !== undefined && { state: opts.state }) });
  }, [nav, router]);
}

/** { pathname, search ("?a=b"), hash, state } like the browser location. */
export function useLocation() {
  const loc = useRouterState({ select: (s) => s.location });
  return useMemo(() => ({
    pathname: loc.pathname,
    search: loc.searchStr || "",
    hash: loc.hash ? `#${loc.hash}` : "",
    state: loc.state,
  }), [loc]);
}

export function useParams() {
  return useTanstackParams({ strict: false });
}

/** [URLSearchParams, setSearchParams(next, { replace })]. */
export function useSearchParams() {
  const { search, pathname } = useLocation();
  const nav = useTanstackNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback((next, opts = {}) => {
    const value = typeof next === "function" ? next(new URLSearchParams(search)) : next;
    const obj = Object.fromEntries(value instanceof URLSearchParams ? value : new URLSearchParams(value));
    nav({ to: pathname, search: obj, replace: !!opts.replace });
  }, [nav, pathname, search]);
  return [params, set];
}

export function Link({ to, replace, state, ...rest }) {
  const { to: path, search } = split(to);
  return <TanstackLink to={path} search={search} replace={replace} state={state} {...rest} />;
}

/** className and children may be functions of { isActive }. `end` matches the path exactly. */
export function NavLink({ to, end, className, children, ...rest }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { to: path, search } = split(to);
  const isActive = end ? pathname === path : pathname === path || pathname.startsWith(`${path.replace(/\/$/, "")}/`);
  return (
    <TanstackLink to={path} search={search} aria-current={isActive ? "page" : undefined} {...rest}
      className={typeof className === "function" ? className({ isActive }) : className}>
      {typeof children === "function" ? children({ isActive }) : children}
    </TanstackLink>
  );
}

export function Navigate({ to, replace, state }) {
  const { to: path, search } = split(to);
  return <TanstackNavigate to={path} search={search} replace={replace} state={state} />;
}
