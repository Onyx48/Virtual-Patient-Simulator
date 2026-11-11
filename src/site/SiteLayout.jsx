// Shell for the public VPS Clinical website: top navigation, footer, and small shared pieces.
// Uses the app's vx tokens and Figtree, so the site and the app read as one product.
import React, { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Link, useLocation } from "../lib/router";
import { useAuth } from "../AuthContext";
import { cn } from "../lib/utils";
import "../components/vx/vx.css";

export const muted = "text-[rgb(var(--vx-muted))]";

const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/for-educators", label: "For educators" },
  { to: "/for-institutions", label: "For institutions" },
  { to: "/about", label: "About" },
];

export function Wordmark({ className }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="VPS Clinical home">
      <span className="grid size-9 place-items-center rounded-xl bg-[rgb(var(--vx-accent))] text-sm font-bold text-[rgb(var(--vx-on-accent))]">VPS</span>
      <span className="text-lg font-semibold tracking-tight">VPS Clinical</span>
    </Link>
  );
}

export function CTA({ to = "/contact", children = "Talk to us", variant = "primary", className }) {
  return (
    <Link to={to} className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors",
      variant === "primary" ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))] hover:brightness-95" : "bg-[rgb(var(--vx-card))] ring-1 ring-[rgb(var(--vx-line))] hover:bg-[rgb(var(--vx-cell))]", className)}>
      {children} {variant === "primary" && <ArrowRight size={18} />}
    </Link>
  );
}

export function Section({ eyebrow, title, intro, children, className, id }) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24", className)}>
      {(eyebrow || title) && (
        <div className="mb-10 max-w-3xl">
          {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[rgb(var(--vx-accent-text))]">{eyebrow}</p>}
          {title && <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>}
          {intro && <p className={cn("mt-3 text-lg leading-relaxed", muted)}>{intro}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHero({ eyebrow, title, intro, children }) {
  return (
    <div className="border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[rgb(var(--vx-accent-text))]">{eyebrow}</p>}
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        {intro && <p className={cn("mt-4 max-w-2xl text-lg leading-relaxed", muted)}>{intro}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </div>
  );
}

export function Card({ icon: Icon, title, children, className }) {
  return (
    <div className={cn("rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-6", className)}>
      {Icon && <span className="mb-4 grid size-11 place-items-center rounded-xl bg-[rgb(var(--vx-accent)/0.15)] text-[rgb(var(--vx-accent-text))]"><Icon size={22} /></span>}
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className={cn("mt-2 text-base leading-relaxed", muted)}>{children}</div>
    </div>
  );
}

export function TalkBand() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
      <div className="flex flex-col items-start gap-6 rounded-3xl bg-[rgb(var(--vx-ink))] p-8 text-[rgb(var(--vx-bg))] md:flex-row md:items-center md:p-12">
        <div className="flex-1">
          <h2 className="text-3xl font-semibold tracking-tight">See it with your own cases</h2>
          <p className="mt-2 max-w-xl text-lg opacity-80">We set up a pilot around your curriculum: your professions, your conditions, your learners. Tell us what you teach and we take it from there.</p>
        </div>
        <CTA>Talk to us</CTA>
      </div>
    </section>
  );
}

export default function SiteLayout({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    return () => { delete document.documentElement.dataset.theme; };
  }, []);

  return (
    <div className="vx flex min-h-screen flex-col bg-[rgb(var(--vx-bg))] text-[rgb(var(--vx-ink))]">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-bg)/0.9)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
          <Wordmark />
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={cn("rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--vx-cell))]", pathname === n.to && "bg-[rgb(var(--vx-cell))]")}>{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link to={user ? "/" : "/login"} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[rgb(var(--vx-cell))]">{user ? "Open the app" : "Sign in"}</Link>
            <Link to="/contact" className="inline-flex h-10 items-center rounded-full bg-[rgb(var(--vx-accent))] px-5 text-sm font-semibold text-[rgb(var(--vx-on-accent))]">Talk to us</Link>
          </div>
          <button type="button" className="ml-auto grid size-10 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))] md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-[rgb(var(--vx-line)/0.7)] px-4 py-3 md:hidden" aria-label="Main">
            {NAV.map((n) => <Link key={n.to} to={n.to} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-[rgb(var(--vx-cell))]">{n.label}</Link>)}
            <Link to={user ? "/" : "/login"} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-[rgb(var(--vx-cell))]">{user ? "Open the app" : "Sign in"}</Link>
            <CTA className="mt-2">Talk to us</CTA>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-6">
          <div>
            <Wordmark />
            <p className={cn("mt-3 max-w-xs text-sm leading-relaxed", muted)}>Virtual patients for health-profession education. Practise history taking and clinical reasoning safely, with feedback that teaches.</p>
            <p className={cn("mt-3 text-sm", muted)}>By Silver Wings XR, developed with the Singapore Institute of Technology.</p>
          </div>
          {[
            ["Product", [["/how-it-works", "How it works"], ["/for-educators", "For educators"], ["/for-institutions", "For institutions"], ["/trust", "Data and AI"]]],
            ["Company", [["/about", "About"], ["/contact", "Contact"], ["/login", "Sign in"]]],
            ["Legal", [["/terms", "Terms of service"], ["/privacy", "Privacy policy"], ["/acceptable-use", "Acceptable use"], ["/cookies", "Cookies"]]],
          ].map(([h, links]) => (
            <div key={h}>
              <p className="mb-3 text-sm font-semibold">{h}</p>
              <ul className="flex flex-col gap-2">{links.map(([to, l]) => <li key={to}><Link to={to} className={cn("text-sm hover:text-[rgb(var(--vx-ink))]", muted)}>{l}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className={cn("mx-auto max-w-6xl border-t border-[rgb(var(--vx-line)/0.7)] px-4 py-6 text-sm md:px-6", muted)}>© {new Date().getFullYear()} Silver Wings XR. All rights reserved.</div>
      </footer>
    </div>
  );
}
