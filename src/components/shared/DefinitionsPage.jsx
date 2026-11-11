// What every number on the dashboards means and how it is calculated (VPS dashboard review: UI17,
// UI21, Olaf's and Ben's "what does this mean?"). Rules match backend/utils/learning.js and
// studentRoutes readiness. Students see only the parts about their own view.
import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { ACTIVITY } from "../vx/bits";
import { cn } from "../../lib/utils";
import "../vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const STAFF = ["educator", "school_admin", "superadmin"];

const SECTIONS = [
  {
    id: "flow", title: "How a session runs", roles: "all",
    items: [
      ["Session", "One attempt at a scenario: a spoken history with the virtual patient (about 15 minutes), a short guided self-reflection, then feedback and a score."],
      ["Self-reflection", "A 3–5 minute conversation straight after the history and before any score is shown, so your own view is not influenced by the feedback. A one-line summary is kept with the session."],
      ["Feedback questions", "A checklist the grader looks for in the conversation, for example \"asked about night pain\". Each is marked met, partly met or not met, with a quote as evidence. Educators can change any verdict; their verdict then counts."],
      ["Criterion", "A group of feedback questions about one skill, such as Red flags and safety screening or Psychosocial exploration."],
    ],
  },
  {
    id: "scores", title: "Scores and target", roles: "all",
    items: [
      ["Session score", "The grader's score for one session, shown as a percentage."],
      ["Target", "75%. A learner is at target when their latest scored session is 75% or higher."],
      ["Criterion %", "For one criterion: the share of its questions met on your latest attempt at each scenario. Partly met counts as half. Under 75% means below standard."],
      ["Progress (pts)", "The difference in percentage points between the first and the latest scored session. 64% → 80% is +16 pts. Needs at least two sessions."],
    ],
  },
  {
    id: "learner", title: "Your dashboard", roles: ["student"],
    items: [
      ["Current focus", "The criterion with the most room to grow across your latest attempts. Its trend shows your repeat attempts at one scenario, because scenarios differ in difficulty."],
      ["Strengths and priorities", "Criteria at or above 75% are strengths; the lowest ones under 75% are priorities."],
      ["Recommended next", "A scenario you have not tried yet, or the one where your focus criterion was weakest."],
      ["Privacy", "Only you and your educator see your results. There are no class rankings."],
    ],
  },
  {
    id: "educator", title: "Educator and admin measures", roles: STAFF,
    items: [
      ["At target", "Learners whose latest scored session is 75% or higher, out of all learners in the selected cohort."],
      ["Active learners", "From each learner's last scored session. Active: within 14 days. At risk: 15–30 days. Inactive: over 30 days. Signing in, or a session without a score, does not count."],
      ["Progress", "For each learner with two or more scored sessions: latest score − first score. The figure is the average, with how many learners it includes."],
      ["Below standard", "For each criterion, the share of learners whose criterion % is under 75% on their latest attempts. The criteria with the most learners below standard are listed first."],
      ["Questions most missed", "The individual feedback questions marked not met most often in the period. Group-level, with no names, so it can go on a projector."],
      ["Score spread", "How many sessions fall in each 20-point band. An average hides a split class; this does not."],
      ["Where you disagree with the AI", "Counted from the verdicts you change in transcripts: how often you agreed, and which questions the AI marks too harshly or too leniently."],
      ["Readiness", "Proposed from the rules: Ready when the learner has practised at least 80% of assigned scenarios with a best-score average of 70% or more, recently. Almost from 50%. You can override it; the page shows who changed it."],
    ],
  },
  {
    id: "activity", title: "Activity colours", roles: STAFF,
    items: [
      [ACTIVITY.active.label, "Last scored session within 14 days.", ACTIVITY.active.dot],
      [ACTIVITY.atrisk.label, "Last scored session 15–30 days ago.", ACTIVITY.atrisk.dot],
      [ACTIVITY.inactive.label, "Last scored session over 30 days ago.", ACTIVITY.inactive.dot],
      [ACTIVITY.new.label, "No scored session yet.", ACTIVITY.new.dot],
    ],
  },
  {
    id: "roles", title: "Who sees what", roles: "all",
    items: [
      ["Learner", "Their own scenarios, sessions, feedback, reflections and private notes."],
      ["Educator", "Their own students and scenarios, down to every transcript. Can correct verdicts and leave notes."],
      ["School admin", "All educators and learners in the school, with the same drill-down."],
      ["Practice scenarios", "Scenarios marked for practice and familiarisation are not graded."],
    ],
  },
];

export default function DefinitionsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const role = user?.role || "student";
  const sections = useMemo(() => SECTIONS
    .filter((s) => s.roles === "all" || s.roles.includes(role))
    .map((s) => ({ ...s, items: s.items.filter(([t, d]) => !q || `${t} ${d}`.toLowerCase().includes(q.toLowerCase())) }))
    .filter((s) => s.items.length), [role, q]);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex w-full flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Definitions</h1>
            <p className={cn("text-base", muted)}>What each number means and how it is calculated.</p>
          </div>
          <label className="flex h-11 w-full items-center gap-2 rounded-full bg-[rgb(var(--vx-cell))] px-4 sm:w-72">
            <Search size={18} className={muted} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a term" aria-label="Find a term"
              className="min-w-0 flex-1 bg-transparent text-base outline-none" />
          </label>
        </header>

        <nav className="flex flex-wrap gap-2 print:hidden">
          {sections.map((s) => (
            <a key={s.id} href={`#def-${s.id}`} className="rounded-full bg-[rgb(var(--vx-cell))] px-3 py-1.5 text-sm font-medium hover:bg-[rgb(var(--vx-accent)/0.15)]">{s.title}</a>
          ))}
        </nav>

        {sections.length === 0 && <p className={cn("py-10 text-center text-base", muted)}>Nothing matches "{q}".</p>}
        {sections.map((s) => (
          <section key={s.id} id={`def-${s.id}`} className="scroll-mt-20 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5">
            <h2 className="mb-3 text-xl font-semibold tracking-tight">{s.title}</h2>
            <dl className="-mx-5 divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {s.items.map(([term, desc, dot]) => (
                <div key={term} className="grid gap-1 px-5 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                  <dt className="flex items-center gap-2 text-base font-semibold">{dot && <span className={cn("size-2.5 rounded-full", dot)} />}{term}</dt>
                  <dd className={cn("text-base leading-relaxed", muted)}>{desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
