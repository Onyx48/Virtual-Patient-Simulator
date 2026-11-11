import React, { Suspense, useEffect, useState } from "react";
import Header from "../Header/Header";
import { MicCheckHost } from "../shared/MicCheck";
import Assistant from "../assistant/Assistant";
import Sidebar from "../Sidebar/Sidebar";
import ContentArea from "../ContentArea/ContentArea";
import { FullPageSpinner } from "../../lib/hooks/useLoading";
import "../vx/vx.css";

const COLLAPSE_KEY = "vps.sidebar.collapsed";
const THEME_KEY = "vps.theme";

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, v) => { try { localStorage.setItem(key, v); } catch { /* private window */ } };

/*
 * App frame after ci/internal-shortlisting: the sidebar sits on the frame colour and the
 * page is an inset panel (rounded, bordered) beside it, with the header inside the panel.
 * `.vx` here gives every page Figtree and the vx type scale (src/components/vx/vx.css).
 * Ctrl+B / Cmd+B collapses the sidebar. The theme follows the system until it is picked.
 */
function Container() {
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSE_KEY) === "1");
  const [theme, setTheme] = useState(() => {
    const saved = read(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => write(COLLAPSE_KEY, collapsed ? "1" : "0"), [collapsed]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  // Settings → Preferences changes the theme through this event.
  useEffect(() => {
    const onTheme = (e) => { if (e.detail === "light" || e.detail === "dark") { write(THEME_KEY, e.detail); setTheme(e.detail); } };
    window.addEventListener("vps-theme", onTheme);
    return () => window.removeEventListener("vps-theme", onTheme);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => setTheme((t) => {
    const next = t === "dark" ? "light" : "dark";
    write(THEME_KEY, next);
    return next;
  });

  return (
    <div className="vx flex h-screen overflow-hidden bg-[rgb(var(--vx-cell))]">
      <Sidebar collapsed={collapsed} />
      <div className="vx-shell flex min-w-0 flex-1 flex-col py-2 pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-bg))] shadow-sm">
          <MicCheckHost />
          <Header collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} theme={theme} onToggleTheme={toggleTheme} />
          <Suspense fallback={<FullPageSpinner />}>
            <ContentArea />
          </Suspense>
        </div>
      </div>
      <Assistant />
    </div>
  );
}

export default Container;
