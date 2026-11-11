// Visual pieces of the room (main.jsx keeps all the session logic).
// Inspired by mindsets/student.md: S1 safe practice, S2 always know what comes next, S3 calm under time.
import React, { useEffect, useState } from "react";
import { Stethoscope, MessageCircleHeart, ClipboardCheck, Brain, Flag, Lock, Mic, Headphones, Clock, Check } from "lucide-react";

export const ROOM_MOTION = `
@keyframes rp-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes rp-drop { from { opacity: 0; transform: translateY(-14px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes rp-ring { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.75); opacity: 0 } }
@keyframes rp-glow { 0%,100% { opacity: .35 } 50% { opacity: .7 } }
@keyframes rp-bar { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
.rp-rise { animation: rp-rise .5s cubic-bezier(.2,.7,.2,1) both }
.rp-drop { animation: rp-drop .45s cubic-bezier(.2,.7,.2,1) both }
.rp-ring { animation: rp-ring 1.6s ease-out infinite }
.rp-glow { animation: rp-glow 4s ease-in-out infinite }
.rp-bar { transform-origin: bottom; animation: rp-bar .9s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .rp-rise, .rp-drop, .rp-ring, .rp-glow, .rp-bar { animation: none } }`;

export const JOURNEY = [
  { key: "consult", label: "History taking", icon: Stethoscope, hint: "Talk with the patient. End the session when you are done." },
  { key: "reflect", label: "Self-reflection", icon: MessageCircleHeart, hint: "A short spoken reflection, before you see any score." },
  { key: "feedback", label: "Feedback", icon: ClipboardCheck, hint: "Your history-taking results, skill by skill." },
  { key: "reasoning", label: "Clinical reasoning", icon: Brain, hint: "Talk through your thinking with the reasoning guide (10 min)." },
  { key: "done", label: "Done", icon: Flag, hint: "Your reasoning feedback, and the full report." },
];

export const journeyOf = (phase) => ({
  consult: "consult", ending: "reflect", reflection: "reflect", feedback: "feedback",
  reasoning: "reasoning", cr_ending: "reasoning", cr_feedback: "done",
}[phase] || "consult");

export function Journey({ phase, started }) {
  const at = started ? JOURNEY.findIndex((j) => j.key === journeyOf(phase)) : -1;
  return (
    <nav aria-label="Session steps" className="shrink-0 border-b border-[rgb(var(--vx-line))] px-4 py-3 sm:px-6">
      {/* Joined steps, like the app's ButtonGroup: 2px apart, inner corners 8px, ends round */}
      <ol className="mx-auto flex max-w-5xl gap-0.5 [&>li:first-child]:rounded-l-full [&>li:last-child]:rounded-r-full">
        {JOURNEY.map((j, i) => {
          const done = i < at, now = i === at, Icon = done ? Check : j.icon;
          return (
            <li key={j.key} aria-current={now ? "step" : undefined} title={j.hint}
              className={`relative flex h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[8px] px-3 text-sm transition-colors duration-500 ${
                now ? "bg-[rgb(var(--vx-accent))] font-semibold text-[rgb(var(--vx-on-accent))]"
                : done ? "bg-[rgb(var(--vx-ok)/0.16)] text-emerald-300" : "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-muted))]"}`}>
              <Icon className="size-[18px] shrink-0" />
              <span className={`truncate ${now ? "" : "hidden md:inline"}`}>{j.label}</span>
              {now && <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-black/25" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// A banner each time the session moves to a new part, so nobody wonders what is happening (S2).
export function StageBanner({ phase, started }) {
  const key = journeyOf(phase);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!started || key === "consult") return;
    setShown(key);
    const t = setTimeout(() => setShown(null), 5000);
    return () => clearTimeout(t);
  }, [key, started]);
  const j = JOURNEY.find((x) => x.key === shown);
  if (!j) return null;
  const Icon = j.icon;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <div key={shown} className="rp-drop flex max-w-lg items-center gap-3 rounded-2xl border border-white/15 bg-neutral-900/90 px-4 py-3 shadow-2xl backdrop-blur">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-neutral-900"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400">Now</p>
          <p className="font-semibold">{j.label}</p>
          <p className="text-sm text-neutral-300">{j.hint}</p>
        </div>
      </div>
    </div>
  );
}

export function IntroCard({ title, patient, initials, firstName, onStart, disabled }) {
  return (
    <div className="rp-rise relative mx-4 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/90 shadow-2xl backdrop-blur">
      <div className="rp-glow pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-sky-500/30 blur-3xl" />
      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-xl font-semibold text-white shadow-lg">{initials}</div>
          <div className="min-w-0 text-left">
            <p className="text-xs uppercase tracking-wider text-sky-300">History taking{firstName ? ` · Hi ${firstName}` : ""}</p>
            <h2 className="mt-0.5 truncate text-2xl font-semibold">{title}</h2>
            <p className="text-sm text-neutral-400">Your patient: {patient}</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-2 text-left sm:grid-cols-2">
          {JOURNEY.slice(0, 4).map((j, i) => {
            const Icon = j.icon;
            return (
              <li key={j.key} className="rp-rise flex gap-3 rounded-xl border border-white/5 bg-white/[.03] p-3" style={{ animationDelay: `${120 + i * 90}ms` }}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10"><Icon className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{i + 1}. {j.label}</span>
                  <span className="block text-xs text-neutral-400">{j.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5"><Headphones className="size-3.5" /> A headset works best</span>
          <span className="flex items-center gap-1.5"><Mic className="size-3.5" /> Speak naturally, as in clinic</span>
          <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> About 15–25 minutes</span>
        </div>

        <button onClick={onStart} disabled={disabled}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[28px] bg-[rgb(var(--vx-accent))] text-base font-semibold text-[rgb(var(--vx-on-accent))] transition-[border-radius,filter] hover:brightness-105 active:rounded-[10px] disabled:opacity-40">
          <Stethoscope className="size-5" /> Meet {patient}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <Lock className="size-3" /> Practice, not an exam. Only you and your educator see how it went.
        </p>
      </div>
    </div>
  );
}

// The patient (or guide) when there is no video: a speaking ring and a little voice bar.
export function Presence({ name, initials, state, label }) {
  const talking = state === "speaking", listening = state === "listening";
  return (
    <div className="rp-rise flex flex-col items-center gap-5 px-6 text-center">
      <div className="relative grid size-40 place-items-center">
        {talking && <><span className="rp-ring absolute inset-0 rounded-full bg-sky-400/40" /><span className="rp-ring absolute inset-0 rounded-full bg-sky-400/30" style={{ animationDelay: ".8s" }} /></>}
        {listening && <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/60" />}
        <div className={`relative grid size-32 place-items-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 text-4xl font-semibold text-neutral-100 shadow-2xl ${state === "connecting" ? "animate-pulse" : ""}`}>{initials}</div>
      </div>
      <div>
        <p className="text-lg font-semibold">{name}</p>
        <p className="mt-1 flex h-5 items-center justify-center gap-2 text-sm text-neutral-400">
          {talking && <span className="flex h-4 items-end gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className="rp-bar w-1 rounded-full bg-sky-300" style={{ height: "100%", animationDelay: `${i * 0.15}s` }} />)}</span>}
          {label}
        </p>
      </div>
    </div>
  );
}

// Session clock that warms up as time runs low (CR has a 10-minute limit).
export function TimerPill({ seconds, limit, text, title }) {
  const left = limit ? limit - seconds : null;
  const tone = left != null && left <= 60 ? "border-red-400/50 bg-red-500/15 text-red-200 animate-pulse" : left != null && left <= 180 ? "border-amber-400/40 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/5";
  return (
    <span title={title} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm tabular-nums transition-colors ${tone}`}>
      <Clock className="size-3.5 opacity-70" />{text}
    </span>
  );
}
