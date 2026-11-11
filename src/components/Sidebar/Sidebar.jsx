import React from "react";
import { NavLink } from "../../lib/router";
import { LayoutGrid, Building2, BookOpen, Users, GraduationCap, Video, Settings, LogOut, ArrowUpRight, BadgeCheck, ListChecks, BookA } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import sitLogo from "../../assets/SIT-logo.jpg";
import { cn } from "../../lib/utils";

/*
 * Where Create Room goes. A plain link: the screenshare app mints the room itself.
 * Set VITE_ROOM_BASE_URL to move it.
 */
const CREATE_ROOM_URL = import.meta.env.VITE_ROOM_BASE_URL || "https://screenshare.gospacesxr.com/create-room";

const ALL = ["superadmin", "school_admin", "educator", "student"];

const itemClass = (active, collapsed) =>
  cn(
    "group flex h-11 items-center gap-3 rounded-full text-base font-medium transition-colors",
    collapsed ? "w-11 justify-center" : "px-4",
    active
      ? "bg-[rgb(var(--vx-card))] text-[rgb(var(--vx-ink))] shadow-sm [&_svg]:text-[rgb(var(--vx-accent-text))]"
      : "text-[rgb(var(--vx-muted))] hover:bg-[rgb(var(--vx-card)/0.6)] hover:text-[rgb(var(--vx-ink))]",
  );

function Item({ item, collapsed }) {
  const Icon = item.icon;
  const body = (
    <>
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
      {!collapsed && item.externalHref && <ArrowUpRight size={16} className="opacity-60" />}
    </>
  );
  // An external item leaves the app, so it is a plain anchor in a new tab.
  if (item.externalHref) {
    return (
      <a href={item.externalHref} target="_blank" rel="noopener noreferrer" title={collapsed ? item.name : undefined} className={itemClass(false, collapsed)}>
        {body}
      </a>
    );
  }
  return (
    <NavLink to={item.path} end={item.path === "/"} title={collapsed ? item.name : undefined} className={({ isActive }) => itemClass(isActive, collapsed)}>
      {body}
    </NavLink>
  );
}

function Sidebar({ collapsed = false }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const role = user?.role;

  const main = [
    { name: t("nav.dashboard"), path: "/", icon: LayoutGrid, roles: ALL },
    { name: t("nav.schools"), path: "/schools", icon: Building2, roles: ["superadmin"] },
    { name: t("nav.scenarios"), path: "/scenarios", icon: BookOpen, roles: ["school_admin", "educator", "student"] },
    { name: t("nav.students"), path: "/students", icon: Users, roles: ["school_admin", "educator"] },
    { name: t("nav.educators"), path: "/educators", icon: GraduationCap, roles: ["school_admin"] },
    { name: "Readiness", path: "/readiness", icon: BadgeCheck, roles: ["educator", "school_admin"] },
    { name: "Rubric bank", path: "/rubrics", icon: ListChecks, roles: ["educator"] },
  ];
  const more = [
    { name: t("nav.createRoom"), externalHref: CREATE_ROOM_URL, icon: Video, roles: ["educator", "student"] },
    { name: "Definitions", path: "/definitions", icon: BookA, roles: ALL },
    { name: t("nav.settings"), path: "/settings", icon: Settings, roles: ALL },
  ];
  const visible = (list) => list.filter((i) => role && i.roles.includes(role));

  return (
    <aside className={cn("flex h-screen shrink-0 flex-col gap-4 py-3 transition-[width] duration-200", collapsed ? "w-[76px] items-center px-2" : "w-64 px-3")}>
      {/* The logo file carries its own black ground, so it is shown as is, rounded, with no tile. */}
      {collapsed ? (
        // Collapsed: only the SiT mark (x 93-243, y 70-220 of the 508x278 file), centred in a 56px tile.
        <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-black" title="Singapore Institute of Technology">
          <img src={sitLogo} alt="Singapore Institute of Technology" className="absolute max-w-none"
            style={{ width: 190, height: 104, left: -35, top: -26 }} />
        </span>
      ) : (
        <img src={sitLogo} alt="Singapore Institute of Technology" className="h-24 w-full shrink-0 rounded-2xl object-cover" />
      )}

      <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto", collapsed && "items-center")} aria-label="Main">
        {visible(main).map((i) => <Item key={i.name} item={i} collapsed={collapsed} />)}
        <div className={cn("my-3 border-t border-[rgb(var(--vx-line))]", collapsed ? "w-8" : "mx-4")} />
        {visible(more).map((i) => <Item key={i.name} item={i} collapsed={collapsed} />)}
      </nav>

      <button type="button" onClick={logout} title={collapsed ? t("nav.logout") : undefined}
        className={cn(itemClass(false, collapsed), "hover:text-[rgb(var(--vx-danger))]")}>
        <LogOut size={20} className="shrink-0" />
        {!collapsed && <span>{t("nav.logout")}</span>}
      </button>
    </aside>
  );
}

export default Sidebar;
