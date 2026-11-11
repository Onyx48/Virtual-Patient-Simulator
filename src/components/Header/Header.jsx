import React, { useEffect, useState } from "react";
import GlobalSearch from "./GlobalSearch";
import ShortcutSheet from "./ShortcutSheet";
import { useLocation, useNavigate } from "../../lib/router";
import { PanelLeft, ChevronRight, Sun, Moon, Sparkles } from "lucide-react";
import { openAssistant } from "../assistant/Assistant";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";

const roleLabel = (role, t) => {
  if (!role) return "";
  const key = `role.${role.toLowerCase()}`;
  const s = t(key);
  return s && s !== key ? s : role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
};

// Section title, and the list page a detail page goes back to.
function pageFor(path, t) {
  if (path.startsWith("/schools/edit/")) return { title: t("page.schools"), back: `/schools/${path.split("/").pop()}` };
  if (path.startsWith("/schools")) return { title: t("page.schools"), back: path !== "/schools" && "/schools" };
  if (path.startsWith("/student/scenario")) return { title: t("page.scenarios"), back: "/scenarios" };
  if (path.startsWith("/scenario")) return { title: t("page.scenarios"), back: path !== "/scenarios" && "/scenarios" };
  if (path.startsWith("/students")) return { title: t("page.students"), back: path !== "/students" && "/students" };
  if (path.startsWith("/educators")) return { title: t("nav.educators"), back: false };
  if (path.startsWith("/groups/")) return { title: "Class", back: "/students" };
  if (path.startsWith("/readiness")) return { title: "Readiness", back: false };
  if (path.startsWith("/definitions")) return { title: "Definitions", back: false };
  if (path.startsWith("/rubrics")) return { title: "Rubric bank", back: false };
  if (path.startsWith("/settings")) return { title: t("page.settings"), back: false };
  return { title: t("page.dashboard"), back: false };
}

/*
 * Breadcrumbs: the section, then the page inside it. A detail page can name its last crumb
 * (e.g. the scenario's name) with setCrumb("..."); until it does, a generic label shows.
 */
export const setCrumb = (label) => window.dispatchEvent(new CustomEvent("vx:crumb", { detail: { label: label || "", path: window.location.pathname } }));
function crumbsFor(path, t, title) {
  const seg = path.split("/").filter(Boolean);
  const home = { label: t("page.dashboard"), to: "/" };
  if (!seg.length) return [{ label: title }];
  const id = seg[seg.length - 1];
  if (path.startsWith("/schools/edit/")) return [home, { label: t("page.schools"), to: "/schools" }, { label: "School", to: `/schools/${id}` }, { label: "Edit" }];
  if (path === "/schools/add") return [home, { label: t("page.schools"), to: "/schools" }, { label: "Add school" }];
  if (path.startsWith("/schools/")) return [home, { label: t("page.schools"), to: "/schools" }, { label: "School", detail: true }];
  if (path === "/scenarios/add") return [home, { label: t("page.scenarios"), to: "/scenarios" }, { label: "New scenario" }];
  if (path.startsWith("/scenarios/edit/")) return [home, { label: t("page.scenarios"), to: "/scenarios" }, { label: "Edit scenario", detail: true }];
  if (path.startsWith("/student/scenario/")) return [home, { label: t("page.scenarios"), to: "/scenarios" }, { label: "Scenario", detail: true }];
  if (path.startsWith("/groups/")) return [home, { label: t("page.students"), to: "/students" }, { label: "Class", detail: true }];
  if (path.startsWith("/students/")) return [home, { label: t("page.students"), to: "/students" }, { label: "Student", detail: true }];
  if (path.startsWith("/settings/")) return [home, { label: t("page.settings"), to: "/settings" }, { label: seg[1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }];
  return [home, { label: title }];
}

const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** The panel's top bar: sidebar toggle, a back arrow on detail pages, the section; language and account on the right. */
function Header({ collapsed, onToggleSidebar, theme, onToggleTheme }) {
  const { user } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { title } = pageFor(pathname, t);
  const [named, setNamed] = useState({});
  useEffect(() => { const on = (e) => setNamed(e.detail); window.addEventListener("vx:crumb", on); return () => window.removeEventListener("vx:crumb", on); }, []);
  const crumbs = crumbsFor(pathname, t, title).map((c) => (c.detail && named.label && named.path === pathname ? { ...c, label: named.label } : c));
  // Browser tab names the page, so several open tabs can be told apart.
  useEffect(() => { document.title = `${title} · Virtual Patient Simulator`; }, [title]);

  const iconBtn = cn("grid size-10 place-items-center rounded-full transition-colors hover:bg-[rgb(var(--vx-cell))]", muted, "hover:text-[rgb(var(--vx-ink))]");

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[rgb(var(--vx-line)/0.7)] px-3">
      {onToggleSidebar && (
        <button type="button" onClick={onToggleSidebar} className={iconBtn} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title="Toggle sidebar (Ctrl+B)">
          <PanelLeft size={20} />
        </button>
      )}
      <span className="h-5 w-px bg-[rgb(var(--vx-line))]" aria-hidden />
      <nav aria-label="Breadcrumb" className="min-w-0 shrink">
        <ol className="flex min-w-0 items-center gap-1 px-1 text-base">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={i} className={cn("flex min-w-0 items-center gap-1", !last && "hidden shrink-0 sm:flex")}>
                {last
                  ? <span aria-current="page" className="truncate px-1.5 font-semibold">{c.label}</span>
                  : <button type="button" onClick={() => navigate(c.to)} className={cn("truncate rounded-lg px-1.5 py-1 transition-colors hover:bg-[rgb(var(--vx-cell))] hover:text-[rgb(var(--vx-ink))]", muted)}>{c.label}</button>}
                {!last && <ChevronRight size={16} className={cn("shrink-0", muted)} aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex flex-1 justify-center px-2"><GlobalSearch role={user?.role} /></div>
      <ShortcutSheet />
      <button type="button" onClick={() => openAssistant()} title="Assistant (Ctrl+J)"
        className="flex h-10 items-center gap-2 rounded-full bg-[rgb(var(--vx-accent)/0.15)] px-3.5 text-sm font-semibold text-[rgb(var(--vx-accent-text))] transition-colors hover:bg-[rgb(var(--vx-accent)/0.25)]">
        <Sparkles size={17} /> <span className="hidden md:inline">Ask</span>
      </button>

      <div className="flex items-center gap-3">
        {onToggleTheme && (
          <button type="button" onClick={onToggleTheme} className={iconBtn}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}
        {/* EN | 日本語. data-no-i18n keeps the DOM translator off it. */}
        <div data-no-i18n role="group" aria-label="Language" className="flex gap-0.5 rounded-full bg-[rgb(var(--vx-cell))] p-1">
          {[{ v: "en", l: "EN" }, { v: "ja", l: "日本語" }].map(({ v, l }) => (
            <button key={v} type="button" aria-pressed={language === v} onClick={() => language !== v && toggleLanguage()}
              className={cn("h-8 rounded-full px-3 text-sm font-medium transition-colors",
                language === v ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : cn(muted, "hover:text-[rgb(var(--vx-ink))]"))}>
              {l}
            </button>
          ))}
        </div>

        {user && (
          <button type="button" onClick={() => navigate("/settings")}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-[rgb(var(--vx-cell))]">
            <span className="grid size-9 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.2)] text-sm font-semibold text-[rgb(var(--vx-accent-text))]">
              {initials(user.name)}
            </span>
            <span className="hidden flex-col text-left leading-tight sm:flex">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className={cn("text-xs", muted)}>{roleLabel(user.role, t)}</span>
            </span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
