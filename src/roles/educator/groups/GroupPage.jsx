// A class (group) as its own page (after ci/internal-shortlisting's class page): join code big enough
// for a projector, the funnel, practice this week, who needs attention grouped by reason (one email
// per reason), what the class misses, the roster and the group's notes.
import React, { useCallback, useEffect, useState } from "react";
import { useCached } from "../../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Maximize2, RefreshCw, Ban, Mail, Loader2, X, KeyRound } from "lucide-react";
import { useNavigate, useParams } from "../../../lib/router";
import { Button, ButtonGroup } from "../../../components/vx/ui";
import { Ago, copyText } from "../../../components/vx/bits";
import { Paged } from "../../../components/vx/list";
import { GroupNotes } from "../../../components/shared/GroupsPanel";
import ComposeEmail from "../../../components/shared/ComposeEmail";
import TranscriptViewerModal from "../../../components/ui/TranscriptViewerModal";
import { Panel, CohortMisses } from "../Dashboard";
import { useAuth } from "../../../AuthContext";
import { getAuthHeaders, cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";

/** The code at projector size, full screen, with how to join. Esc closes. */
function Projector({ code, name, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="vx fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 p-8" style={{ background: "rgb(var(--vx-bg))" }}>
      <button type="button" onClick={onClose} aria-label="Close" className={cn("absolute right-6 top-6 grid size-12 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]", muted)}><X size={24} /></button>
      <p className="text-3xl font-semibold">{name}</p>
      <p className="font-mono text-[clamp(4rem,14vw,12rem)] font-bold leading-none tracking-[0.15em]">{code}</p>
      <p className={cn("max-w-2xl text-center text-2xl", muted)}>Sign in, open your dashboard, and type this code under <b>Join a class</b>.</p>
    </div>
  );
}

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [d, setD, refetch, q] = useCached(`/api/groups/${id}/overview`);
  useEffect(() => { if (q.isError) { toast.error("Could not load this class."); navigate("/students"); } }, [q.isError, navigate]);
  const [busy, setBusy] = useState(false);
  const [projector, setProjector] = useState(false);
  const [compose, setCompose] = useState(null);
  const [transcript, setTranscript] = useState(null);

  const load = refetch;

  const setCode = async (on) => {
    setBusy(true);
    try {
      const { data } = on ? await axios.post(`/api/groups/${id}/join-code`, {}, getAuthHeaders()) : await axios.delete(`/api/groups/${id}/join-code`, getAuthHeaders());
      setD((x) => ({ ...x, group: { ...x.group, joinCode: data.joinCode } }));
      toast.success(on ? "New code made. The old one stops working." : "Joining by code is off.");
    } catch (e) { toast.error(e.response?.data?.message || "That did not work."); } finally { setBusy(false); }
  };

  if (!d) return <div className={cn("vx flex min-h-full items-center justify-center gap-2 p-10 text-base", muted)}><Loader2 className="animate-spin" size={18} /> Loading class…</div>;
  const g = d.group;
  const max = Math.max(1, d.funnel[0]?.students || 1);
  const weekMax = Math.max(1, ...d.week.map((w) => w.sessions));
  const practisedDays = d.week.filter((w) => w.sessions > 0).length;

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{g.name}</h1>
            <p className={cn("text-base", muted)}>{d.roster.length} student{d.roster.length === 1 ? "" : "s"} · {d.scenarios.length} scenario{d.scenarios.length === 1 ? "" : "s"} assigned</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/students?group=${id}`)}>Open in Students</Button>
        </header>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Join code">
            {g.joinCode ? (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => copyText(g.joinCode, "Code copied")} title="Copy"
                  className="rounded-2xl bg-[rgb(var(--vx-accent)/0.12)] py-5 font-mono text-5xl font-bold tracking-[0.2em]">{g.joinCode}</button>
                <p className={cn("text-sm", muted)}>Students type it under <b>Join a class</b> on their dashboard.</p>
                <ButtonGroup>
                  <Button size="sm" onClick={() => setProjector(true)}><Maximize2 /> Show on projector</Button>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCode(true)}><RefreshCw /> New code</Button>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCode(false)}><Ban /> Turn off</Button>
                </ButtonGroup>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className={cn("text-base", muted)}>Make a code and show it to the class. Students who type it join this group, without you adding them one by one.</p>
                <Button disabled={busy} onClick={() => setCode(true)}><KeyRound /> Make a join code</Button>
              </div>
            )}
          </Panel>

          <Panel title="Where the class is">
            <ul className="flex flex-col gap-2">
              {d.funnel.map((f) => (
                <li key={f.stage}>
                  <div className="flex justify-between text-sm"><span>{f.stage}</span><b className="tabular-nums">{f.students}</b></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><div className="h-full rounded-full bg-[rgb(var(--vx-accent))]" style={{ width: `${(f.students / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="This week">
            <p className="mb-3 text-base"><b className="tabular-nums">{practisedDays}</b> of 7 days with practice · <b className="tabular-nums">{d.week.reduce((t, w) => t + w.sessions, 0)}</b> sessions</p>
            <div className="flex h-24 items-end gap-2">
              {d.week.map((w) => (
                <div key={w.date} className="flex flex-1 flex-col items-center gap-1" title={`${w.sessions} session${w.sessions === 1 ? "" : "s"}`}>
                  <div className={cn("w-full rounded-md", w.sessions ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-cell))]")} style={{ height: `${Math.max(8, (w.sessions / weekMax) * 80)}px` }} />
                  <span className={cn("text-xs", muted)}>{new Date(w.date).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {d.attention.length > 0 && (
          <Panel title="Needs you">
            <ul className="-mx-5 divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {d.attention.map((a) => (
                <li key={a.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{a.label} <span className={cn("font-normal", muted)}>· {a.students.length}</span></span>
                    <span className={cn("block truncate text-sm", muted)}>{a.students.map((s) => s.name).join(", ")}</span>
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setCompose({ students: a.students.map((s) => ({ id: s._id, name: s.name, email: s.email })) })}><Mail /> Email them</Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <CohortMisses navigate={navigate} filters={{ groupId: id }} />

        <Panel title="Students">
          {d.roster.length === 0 ? <p className={cn("py-6 text-center text-base", muted)}>Nobody in this class yet. Share the join code, or add students from the Students page.</p> : (
            <div className="-mx-5 overflow-x-auto">
              <Paged rows={d.roster} size={16}>{(page) => (
              <table className="w-full border-collapse">
                <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                  <tr>{["Student", "Practised", "Average", "Last session", ""].map((h, i) => (
                    <th key={h || i} className={cn("whitespace-nowrap px-5 py-2.5 text-sm font-medium", muted, i === 1 || i === 2 ? "text-right" : "text-left")}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                  {page.map((r) => (
                    <tr key={r._id} onClick={() => setTranscript({ studentId: r._id, studentName: r.name })} className="cursor-pointer hover:bg-[rgb(var(--vx-accent)/0.05)]">
                      <td className="px-5 py-3"><div className="text-base font-semibold">{r.name}</div><div className={cn("text-sm", muted)}>{r.email}</div></td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{r.covered}<span className={muted}> of {r.assigned}</span></td>
                      <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{r.avg == null ? <span className={muted}>—</span> : `${r.avg}%`}</td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !r.lastSessionAt && muted)}><Ago date={r.lastSessionAt} fallback="Never" /></td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-sm", muted)}>{r.lastLoginAt ? "" : "never signed in"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}</Paged>
            </div>
          )}
        </Panel>

        <Panel title="Class notes">
          <GroupNotes group={{ _id: g._id, name: g.name, notes: d.notes }} onChanged={(ng) => setD((x) => ({ ...x, notes: ng.notes }))} />
        </Panel>
      </div>

      {projector && g.joinCode && <Projector code={g.joinCode} name={g.name} onClose={() => setProjector(false)} />}
      {compose && <ComposeEmail to={compose} fromName={user?.name} onClose={() => setCompose(null)} />}
      {transcript && <TranscriptViewerModal isOpen onClose={() => setTranscript(null)} student={{ id: transcript.studentId, name: transcript.studentName }} />}
    </div>
  );
}
