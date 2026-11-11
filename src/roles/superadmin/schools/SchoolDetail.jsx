// One school, for the superadmin (mindsets/superadmin.md): adoption, set-up, renewal, health, notes.
// GET /api/dashboard/school/:id. Actions reuse the existing endpoints (invite, PUT school, notes).
import React, { useCallback, useEffect, useState } from "react";
import { useCached, fetchCached } from "../../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { Pencil, CalendarPlus, Send, KeyRound, Printer, Loader2, Trash2, StickyNote, Activity, Users, BookOpen, GraduationCap, AlertTriangle, Wrench } from "lucide-react";
import { useNavigate, useParams } from "../../../lib/router";
import { Button, ButtonGroup } from "../../../components/vx/ui";
import { Ago, CopyButton } from "../../../components/vx/bits";
import { Paged } from "../../../components/vx/list";
import ConfirmationModal from "../../../components/ui/ConfirmationModal";
import { Kpi, Panel } from "../../educator/Dashboard";
import { ActivityChart, RenewalChip } from "../Dashboard";
import { getAuthHeaders, cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const fmt = (d) => (d ? format(new Date(d), "d MMM yyyy") : "—");

export default function SchoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD, refetch, q] = useCached(`/api/dashboard/school/${id}`);
  useEffect(() => { if (q.isError) { toast.error("Could not load this school."); navigate("/schools"); } }, [q.isError, navigate]);
  const [confirm, setConfirm] = useState(null); // { title, message, run, label }
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = refetch;

  if (!d) return <div className={cn("vx flex min-h-full items-center justify-center gap-2 p-10 text-base", muted)}><Loader2 className="animate-spin" size={18} /> Loading school…</div>;
  const { school: s, admin, totals: t } = d;
  const invited = s.inviteStatus === "invited";

  const invite = () => setConfirm({
    title: invited ? "Send a new password?" : "Send the invite?",
    message: invited ? `A new password goes to ${admin?.email || s.email}. Their current one stops working.`
      : admin ? `Email login details to ${admin.email}?` : `${s.name} has no admin yet. An admin account is created for ${s.email} and the login emailed.`,
    label: invited ? "Send new password" : "Send invite",
    run: async () => {
      const { data } = await axios.post(`/api/schools/${id}/invite`, {}, getAuthHeaders());
      toast.success(data.message || "Sent.");
    },
  });

  // Same rule as the Schools list: 12 months on from the later of today and the current end date.
  const extend = async () => {
    const full = await fetchCached(`/api/schools/${id}`);
    const base = full.expireDate && new Date(full.expireDate) > new Date() ? new Date(full.expireDate) : new Date();
    const next = new Date(base); next.setFullYear(next.getFullYear() + 1);
    setConfirm({
      title: `Extend ${s.name}?`, message: `The subscription will end on ${fmt(next)} and the school stays Active.`, label: "Extend",
      run: async () => {
        // PUT overwrites every field it is not sent, so send the whole record.
        await axios.put(`/api/schools/${id}`, {
          schoolName: full.schoolName, description: full.description || "", email: full.email, subscriptionType: full.subscriptionType,
          duration: full.duration || "1 Year", permissions: full.permissions || "Read Only", status: "Active",
          startDate: format(full.startDate ? new Date(full.startDate) : new Date(), "dd/MM/yyyy"), expireDate: format(next, "dd/MM/yyyy"),
        }, getAuthHeaders());
        toast.success(`Extended to ${fmt(next)}.`);
      },
    });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      const { data } = await axios.post(`/api/schools/${id}/notes`, { text: note }, getAuthHeaders());
      setD((x) => ({ ...x, notes: [...x.notes, data] }));
      setNote("");
    } catch (e) { toast.error(e.response?.data?.message || "Could not add the note."); }
  };
  const removeNote = async (n) => {
    try {
      await axios.delete(`/api/schools/${id}/notes/${n._id}`, getAuthHeaders());
      setD((x) => ({ ...x, notes: x.notes.filter((y) => y._id !== n._id) }));
    } catch (e) { toast.error(e.response?.data?.message || "Could not remove the note."); }
  };

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{s.name}</h1>
            <p className={cn("mt-1 flex flex-wrap items-center gap-2 text-base", muted)}>
              <RenewalChip daysLeft={s.daysLeft} status={s.status} />
              <span>{s.plan || "No plan"} · {fmt(s.startDate)} – {fmt(s.expireDate)}</span>
            </p>
            {s.description && <p className={cn("mt-1 text-base", muted)}>{s.description}</p>}
          </div>
          <ButtonGroup className="print:hidden">
            <Button variant="secondary" onClick={() => navigate(`/schools/edit/${id}`)}><Pencil /> Edit</Button>
            <Button variant="secondary" onClick={extend}><CalendarPlus /> Extend a year</Button>
            <Button variant="secondary" onClick={invite}>{invited ? <KeyRound /> : <Send />} {invited ? "New password" : "Send invite"}</Button>
            <Button variant="secondary" onClick={() => window.print()} title="Print or save as PDF for a renewal meeting"><Printer /> Print</Button>
          </ButtonGroup>
        </header>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Kpi icon={Users} label="Students" value={t.students} hint={`${t.studentsSignedIn} have signed in`} />
          <Kpi icon={Activity} label="Active this week" value={t.activeStudents7} hint="students who practised" />
          <Kpi icon={Activity} label="Sessions, 30 days" value={t.sessions30} />
          <Kpi icon={GraduationCap} label="Educators" value={t.educators} />
          <Kpi icon={BookOpen} label="Scenarios" value={t.scenarios} hint={`${t.published} published`} />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <ActivityChart weeks={d.weeks} months={d.months} />
          <div className="flex flex-col gap-3">
            <Panel title="Admin">
              {admin ? (
                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{admin.name}</span>
                  <span className={cn("flex items-center gap-0.5 text-sm", muted)}>{admin.email}<CopyButton value={admin.email} label="Copy email" className="size-6" size={13} /></span>
                  <span className="text-sm">{admin.lastLoginAt ? <>Signed in <Ago date={admin.lastLoginAt} /></> : <span className="font-medium text-[rgb(var(--vx-warn))]">Never signed in{s.inviteSentAt ? <> · invited <Ago date={s.inviteSentAt} /></> : ""}</span>}</span>
                </div>
              ) : <p className="text-base font-medium text-[rgb(var(--vx-warn))]">No admin yet. Send the invite to create one.</p>}
            </Panel>
            <Panel title="Health, 30 days">
              <ul className="flex flex-col gap-2 text-base">
                <li className="flex items-center gap-2">
                  <AlertTriangle size={18} className={t.unfinished30 ? "text-[rgb(var(--vx-warn))]" : muted} />
                  <span className="flex-1">Sessions that did not finish</span><b className="tabular-nums">{t.unfinished30}</b>
                </li>
                <li className="flex items-center gap-2">
                  <Wrench size={18} className={t.technical30 ? "text-[rgb(var(--vx-danger))]" : muted} />
                  <span className="flex-1">Technical problems reported by students</span><b className="tabular-nums">{t.technical30}</b>
                </li>
              </ul>
              <p className={cn("mt-2 text-sm", muted)}>"Did not finish": started over 2 hours ago with no conversation. Simulator errors are not recorded yet.</p>
            </Panel>
          </div>
        </div>

        <Panel title="Educators">
          {d.educators.length === 0 ? <p className={cn("py-6 text-center text-base", muted)}>No educators yet.</p> : (
            <div className="-mx-5 overflow-x-auto">
              <Paged rows={d.educators} size={16}>{(page) => (
              <table className="w-full border-collapse">
                <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                  <tr>{["Educator", "Students", "Scenarios", "Sessions (30 d)", "Last session", "Last sign-in"].map((h, i) => (
                    <th key={h} className={cn("whitespace-nowrap px-5 py-2.5 text-sm font-medium", muted, i && i < 4 ? "text-right" : "text-left")}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                  {page.map((e) => (
                    <tr key={e._id}>
                      <td className="px-5 py-3"><div className="text-base font-semibold">{e.name}</div><div className={cn("text-sm", muted)}>{e.email}</div></td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{e.students}</td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{e.scenarios}</td>
                      <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{e.sessions30}</td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !e.lastSessionAt && muted)}><Ago date={e.lastSessionAt} fallback="None" /></td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !e.lastLoginAt && muted)}><Ago date={e.lastLoginAt} fallback="Never" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}</Paged>
            </div>
          )}
        </Panel>

        <Panel title="Notes">
          {d.notes.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1.5">
              {d.notes.map((n) => (
                <li key={n._id} className="group/note flex items-start gap-2 rounded-xl bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2">
                  <StickyNote size={15} className={cn("mt-1 shrink-0", muted)} />
                  <span className="min-w-0 flex-1"><span className="block whitespace-pre-wrap text-base">{n.text}</span>
                    <span className={cn("text-xs", muted)}>{n.authorName || "Superadmin"} · <Ago date={n.createdAt} /></span></span>
                  {n.mine && <button type="button" onClick={() => removeNote(n)} aria-label="Remove note" className={cn("grid size-7 place-items-center rounded-full opacity-0 hover:bg-[rgb(var(--vx-card))] focus:opacity-100 group-hover/note:opacity-100 print:hidden", muted)}><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 print:hidden">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }}
              placeholder='e.g. "Renewal call booked 12 Dec with the programme lead"' aria-label="New note"
              className="h-11 min-w-0 flex-1 rounded-full border-0 bg-[rgb(var(--vx-cell))] px-4 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
            <Button variant="secondary" className="h-11" onClick={addNote} disabled={!note.trim()}>Add note</Button>
          </div>
          <p className={cn("mt-2 text-sm", muted)}>Only superadmins see these notes.</p>
        </Panel>
      </div>

      <ConfirmationModal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.label}
        onConfirm={async () => {
          const c = confirm; setConfirm(null); setBusy(true);
          try { await c.run(); load(); } catch (e) { toast.error(e.response?.data?.message || "That did not work."); } finally { setBusy(false); }
        }} />
      {busy && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-[rgb(var(--vx-card))] px-4 py-2 shadow-lg"><Loader2 className="inline animate-spin" size={16} /> Working…</div>}
    </div>
  );
}
