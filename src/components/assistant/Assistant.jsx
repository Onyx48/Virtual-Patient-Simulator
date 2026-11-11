/*
 * The assistant panel (after ci/internal-shortlisting's workspace chat). Opens from the header
 * button or Ctrl+J. Answers come from /api/assistant/chat, scoped to the caller's own data. The
 * reply may hold blocks the panel draws: <chart>, <students> and <actions>. Actions never run by
 * themselves; the user presses Confirm and /api/assistant/execute checks each one again.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchCached } from "../../lib/query";
import axios from "axios";
import { Sparkles, X, Send, Plus, History, Trash2, Loader2, Check, AlertCircle, Mail, BookOpen, Users, StickyNote, BadgeCheck, CalendarPlus, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "../../lib/router";
import { getAuthHeaders, cn } from "../../lib/utils";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { Button } from "../vx/ui";
import { timeAgo } from "../vx/bits";

const muted = "text-[rgb(var(--vx-muted))]";
const STAFF = ["educator", "school_admin"];

const SUGGEST = {
  educator: ["Who needs my attention this week?", "Which skills is my class weakest at?", "Who hasn't started their assigned scenarios?", "Draft a reminder to my inactive students", "Compare my groups' latest scores"],
  school_admin: ["How is the school doing this month?", "Which educators' students are least active?", "Which skills are weakest across the school?", "Show latest scores by group"],
  student: ["What should I practise next?", "Which skill should I work on?", "How have my scores changed?", "Give me a tip for my weakest skill"],
  superadmin: ["Which schools expire in the next 60 days?", "Which schools had no sessions this month?", "Show sessions per school"],
};

/* ---------- Rendering the reply ---------- */

const BLOCK = /<(chart|students|actions)([^>]*)>([\s\S]*?)<\/\1>/g;
function splitBlocks(text) {
  const out = [];
  let last = 0, m;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(text))) {
    if (m.index > last) out.push({ kind: "md", text: text.slice(last, m.index) });
    const attrs = Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    let data = null;
    try { data = JSON.parse(m[3].trim().replace(/^```(json)?|```$/g, "")); } catch { /* shown as text below */ }
    out.push(data == null ? { kind: "md", text: m[3] } : { kind: m[1], attrs, data });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "md", text: text.slice(last) });
  return out;
}

/** Bold and inline code only; everything else is plain text (no HTML injection). */
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b>
    : p.startsWith("`") ? <code key={i} className="rounded bg-[rgb(var(--vx-cell))] px-1 text-[0.9em]">{p.slice(1, -1)}</code> : <React.Fragment key={i}>{p}</React.Fragment>);
}

function Markdown({ text }) {
  const lines = String(text).replace(/<thinking>[\s\S]*?<\/thinking>/g, "").split("\n");
  const blocks = [];
  let list = null;
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (bullet) { (list ||= []).push(bullet[1]); return; }
    if (list) { blocks.push({ t: "ul", items: list }); list = null; }
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)/);
    blocks.push(h ? { t: "h", text: h[1] } : { t: "p", text: line });
  });
  if (list) blocks.push({ t: "ul", items: list });
  return blocks.map((b, i) => b.t === "ul" ? (
    <ul key={i} className="my-1 flex list-disc flex-col gap-1 pl-5">{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>
  ) : b.t === "h" ? <p key={i} className="mt-2 font-semibold"><Inline text={b.text} /></p> : <p key={i} className="my-1"><Inline text={b.text} /></p>);
}

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function ChartBlock({ spec }) {
  const data = (spec.data || []).slice(0, 12).map((d) => ({ name: String(d.name ?? d.label ?? ""), value: Number(d.value ?? d.score ?? 0) || 0 }));
  if (!data.length) return null;
  const unit = spec.unit || "";
  return (
    <div className="my-2 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-bg))] p-3">
      {spec.title && <p className="mb-1 text-sm font-semibold">{spec.title}</p>}
      <div className="vx-chart">
        {spec.type === "pie" ? (
          <div className="flex items-center gap-4">
            <PieChart size={140} innerRadius={44} cornerRadius={4} padAngle={0.02} data={data.map((d, i) => ({ label: d.name, value: d.value, color: PALETTE[i % PALETTE.length] }))}>
              {data.map((_, i) => <PieSlice key={i} index={i} />)}
            </PieChart>
            <ul className="flex flex-col gap-1 text-sm">{data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}<b className="tabular-nums">{d.value}{unit}</b></li>
            ))}</ul>
          </div>
        ) : (
          <BarChart data={data} xDataKey="name" aspectRatio="auto" className="h-[180px]" margin={{ top: 10, right: 4, bottom: 34, left: 4 }} maxBarWidth={32} animationDuration={500}>
            <Grid horizontal vertical={false} />
            <Bar dataKey="value" fill="var(--chart-1)" />
            <BarXAxis showAllLabels />
            <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: p.name, value: `${p.value}${unit}` }]} />
          </BarChart>
        )}
      </div>
    </div>
  );
}

function StudentsBlock({ ids, roster, onClose }) {
  const navigate = useNavigate();
  const rows = (Array.isArray(ids) ? ids : []).map((id) => roster.get(String(id))).filter(Boolean).slice(0, 12);
  if (!rows.length) return null;
  return (
    <ul className="my-2 flex flex-col gap-1.5">
      {rows.map((s) => (
        <li key={s._id}>
          <button type="button" onClick={() => { onClose(); navigate(`/students?q=${encodeURIComponent(s.email || s.name)}`); }}
            className="flex w-full items-center gap-3 rounded-xl bg-[rgb(var(--vx-bg))] px-3 py-2 text-left transition-colors hover:bg-[rgb(var(--vx-accent)/0.1)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.2)] text-xs font-semibold">
              {String(s.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className={cn("block truncate text-xs", muted)}>{s.email}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const ICON = { email: Mail, assign: BookOpen, move_group: Users, note: StickyNote, readiness: BadgeCheck, extend_school: CalendarPlus };
function describe(a, roster, names) {
  const who = (ids) => {
    const list = (ids || []).map((id) => roster.get(String(id))?.name).filter(Boolean);
    return list.length > 3 ? `${list.slice(0, 3).join(", ")} and ${list.length - 3} more` : list.join(", ") || `${(ids || []).length} learner(s)`;
  };
  switch (a.type) {
    case "email": return { title: `Email ${who(a.studentIds)}`, detail: a.subject, body: a.body };
    case "assign": return { title: `Assign ${names.scenarios.get(a.scenarioId) || "a scenario"}`, detail: `to ${who(a.studentIds)}` };
    case "move_group": return { title: `Move to ${names.groups.get(a.groupId) || "a group"}`, detail: who(a.studentIds) };
    case "note": return { title: `Note on ${who([a.studentId])}`, body: a.text };
    case "readiness": return { title: `Mark ${who([a.studentId])} as ${{ ready: "Ready", almost: "Almost", notyet: "Not yet" }[a.status] || a.status}`, detail: a.note };
    case "extend_school": return { title: `Extend licence by ${a.months || 12} months`, detail: names.schools?.get(a.schoolId) };
    default: return { title: "Unknown action", detail: JSON.stringify(a) };
  }
}

function ActionsBlock({ title, actions, roster, names, executed, onRun }) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(null);
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) return null;
  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-[rgb(var(--vx-accent)/0.5)] bg-[rgb(var(--vx-accent)/0.06)]">
      <div className="flex items-center gap-2 border-b border-[rgb(var(--vx-accent)/0.25)] px-4 py-2.5">
        <Sparkles size={16} className="text-[rgb(var(--vx-accent-text))]" />
        <span className="flex-1 text-sm font-semibold">{title || "Proposed changes"}</span>
        <span className={cn("text-xs", muted)}>{executed ? "Done" : "Needs your OK"}</span>
      </div>
      <ul className="divide-y divide-[rgb(var(--vx-line)/0.6)]">
        {list.map((a, i) => {
          const d = describe(a, roster, names);
          const Icon = ICON[a.type] || Sparkles;
          const r = executed?.results?.[i];
          return (
            <li key={i} className="px-4 py-2.5">
              <div className="flex items-start gap-2.5">
                <Icon size={16} className={cn("mt-0.5 shrink-0", muted)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{d.title}</p>
                  {d.detail && <p className={cn("text-xs", muted)}>{d.detail}</p>}
                  {d.body && (
                    <button type="button" onClick={() => setOpen(open === i ? null : i)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--vx-accent-text))]">
                      {open === i ? "Hide" : "Read"} text <ChevronDown size={12} className={open === i ? "rotate-180" : ""} />
                    </button>
                  )}
                  {open === i && <p className="mt-1 whitespace-pre-line rounded-lg bg-[rgb(var(--vx-card))] p-2 text-xs">{d.body}</p>}
                </div>
                {r && (r.ok ? <Check size={16} className="shrink-0 text-[rgb(var(--vx-ok))]" /> : <AlertCircle size={16} className="shrink-0 text-[rgb(var(--vx-danger))]" />)}
              </div>
              {r && <p className={cn("ml-6 mt-0.5 text-xs", r.ok ? "text-[rgb(var(--vx-ok))]" : "text-[rgb(var(--vx-danger))]")}>{r.detail}</p>}
            </li>
          );
        })}
      </ul>
      {!executed && !dismissed && (
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <Button variant="secondary" size="sm" onClick={() => setDismissed(true)}>Dismiss</Button>
          <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await onRun(list); setBusy(false); }}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Confirm
          </Button>
        </div>
      )}
      {dismissed && !executed && <p className={cn("px-4 py-2 text-xs", muted)}>Dismissed. Nothing was changed.</p>}
    </div>
  );
}

function Reply({ msg, roster, names, onRun, onClose }) {
  const parts = useMemo(() => splitBlocks(msg.content || ""), [msg.content]);
  return parts.map((p, i) => p.kind === "md" ? <Markdown key={i} text={p.text} />
    : p.kind === "chart" ? <ChartBlock key={i} spec={p.data} />
    : p.kind === "students" ? <StudentsBlock key={i} ids={p.data} roster={roster} onClose={onClose} />
    : <ActionsBlock key={i} title={p.attrs.title} actions={p.data} roster={roster} names={names} executed={msg.executed} onRun={(a) => onRun(msg, a)} />);
}

/* ---------- Panel ---------- */

export default function Assistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState(new Map());
  const [names, setNames] = useState({ scenarios: new Map(), groups: new Map(), schools: new Map() });
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const role = user?.role;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = (e) => { setOpen(true); if (e.detail?.prompt) setText(e.detail.prompt); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("vps-assistant", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("vps-assistant", onOpen); };
  }, []);

  // Names for cards and proposals, loaded once when first opened.
  useEffect(() => {
    if (!open || roster.size || !role) return;
    const get = (u) => fetchCached(u).then((d) => (Array.isArray(d) ? d : d?.items || [])).catch(() => []);
    if (STAFF.includes(role)) {
      Promise.all([get("/api/students"), get("/api/scenarios?fields=lite"), get("/api/groups")]).then(([st, sc, gr]) => {
        setRoster(new Map(st.map((s) => [String(s._id || s.id), { _id: s._id || s.id, name: s.name, email: s.email }])));
        setNames((n) => ({ ...n, scenarios: new Map(sc.map((s) => [String(s._id), s.scenarioName])), groups: new Map(gr.map((g) => [String(g._id), g.name])) }));
      });
    } else if (role === "superadmin") {
      get("/api/schools").then((sc) => setNames((n) => ({ ...n, schools: new Map(sc.map((s) => [String(s._id), s.name])) })));
    }
  }, [open, role, roster.size]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const loadChats = () => fetchCached("/api/assistant/chats").then(setChats).catch(() => setChats([]));
  const openChat = async (id) => {
    const data = await fetchCached(`/api/assistant/chats/${id}`);
    setChatId(data._id); setMessages(data.messages || []); setShowHistory(false);
  };
  const newChat = () => { setChatId(null); setMessages([]); setShowHistory(false); inputRef.current?.focus(); };

  const send = async (q) => {
    const message = String(q ?? text).trim();
    if (!message || busy) return;
    setText("");
    setMessages((m) => [...m, { _id: `u${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const { data } = await axios.post("/api/assistant/chat", { chatId, message }, getAuthHeaders());
      setChatId(data.chatId);
      setMessages((m) => [...m, data.message]);
      setChats(null);
    } catch (err) {
      setMessages((m) => [...m, { _id: `e${Date.now()}`, role: "assistant", content: err.response?.data?.message || "Something went wrong. Try again.", error: true }]);
    } finally { setBusy(false); }
  };

  const run = async (msg, actions) => {
    try {
      const { data } = await axios.post("/api/assistant/execute", { chatId, messageId: msg._id, actions }, getAuthHeaders());
      setMessages((m) => m.map((x) => (x._id === msg._id ? { ...x, executed: { results: data.results } } : x)));
      const ok = data.results.filter((r) => r.ok).length;
      toast[ok === data.results.length ? "success" : "error"](`${ok} of ${data.results.length} done`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not run those changes.");
    }
  };

  if (!user) return null;
  const suggestions = SUGGEST[role] || [];

  return (
    <>
      {open && <div className="fixed inset-0 z-[55] md:hidden" style={{ background: "rgb(0 0 0/0.35)" }} onClick={() => setOpen(false)} />}
      <aside aria-label="Assistant" aria-hidden={!open}
        className={cn("vx fixed bottom-2 right-2 top-2 z-[56] flex w-[min(100vw-1rem,28rem)] flex-col overflow-hidden rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] shadow-2xl transition-transform duration-200 print:hidden",
          open ? "translate-x-0" : "pointer-events-none translate-x-[110%]")}>
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[rgb(var(--vx-line)/0.7)] px-3">
          <Sparkles size={18} className="text-[rgb(var(--vx-accent-text))]" />
          <span className="ml-1.5 flex-1 text-base font-semibold">Assistant</span>
          <button type="button" title="Past chats" aria-label="Past chats" onClick={() => { setShowHistory((s) => !s); if (!chats) loadChats(); }}
            className={cn("grid size-9 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]", showHistory && "bg-[rgb(var(--vx-cell))]")}><History size={18} /></button>
          <button type="button" title="New chat" aria-label="New chat" onClick={newChat} className="grid size-9 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]"><Plus size={18} /></button>
          <button type="button" title="Close (Esc)" aria-label="Close" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]"><X size={18} /></button>
        </header>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-2">
            {!chats ? <p className={cn("p-4 text-sm", muted)}>Loading…</p> : chats.length === 0 ? <p className={cn("p-4 text-sm", muted)}>No past chats yet.</p> : (
              <ul className="flex flex-col">
                {chats.map((c) => (
                  <li key={c._id} className="group flex items-center rounded-xl hover:bg-[rgb(var(--vx-cell)/0.7)]">
                    <button type="button" onClick={() => openChat(c._id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className={cn("text-xs", muted)}>{timeAgo(c.updatedAt)}</span>
                    </button>
                    <button type="button" aria-label="Delete chat" onClick={async () => {
                      await axios.delete(`/api/assistant/chats/${c._id}`, getAuthHeaders()).catch(() => {});
                      setChats((l) => l.filter((x) => x._id !== c._id));
                      if (chatId === c._id) newChat();
                    }} className={cn("mr-2 grid size-8 place-items-center rounded-full opacity-0 hover:text-[rgb(var(--vx-danger))] group-hover:opacity-100", muted)}><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-4 pt-6">
                <div>
                  <p className="text-xl font-semibold">How can I help{user.name ? `, ${String(user.name).split(/\s+/).find((w) => !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)) || ""}` : ""}?</p>
                  <p className={cn("text-sm", muted)}>
                    {role === "student" ? "Ask about your practice: what to do next, which skill to work on, how you are improving."
                      : "Ask about your learners and scenarios. I can draft emails and changes too; nothing happens until you press Confirm."}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}
                      className="rounded-xl border border-[rgb(var(--vx-line)/0.8)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[rgb(var(--vx-accent)/0.6)] hover:bg-[rgb(var(--vx-accent)/0.06)]">{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-4">
              {messages.map((m) => m.role === "user" ? (
                <div key={m._id} className="ml-8 self-end whitespace-pre-line rounded-2xl rounded-br-md bg-[rgb(var(--vx-accent))] px-3.5 py-2 text-sm text-[rgb(var(--vx-on-accent))]">{m.content}</div>
              ) : (
                <div key={m._id} className={cn("text-sm leading-relaxed", m.error && "text-[rgb(var(--vx-danger))]")}>
                  <Reply msg={m} roster={roster} names={names} onRun={run} onClose={() => setOpen(false)} />
                </div>
              ))}
              {busy && <p className={cn("flex items-center gap-2 text-sm", muted)}><Loader2 size={16} className="animate-spin" /> Looking at your data…</p>}
              <div ref={endRef} />
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="shrink-0 border-t border-[rgb(var(--vx-line)/0.7)] p-3">
          <div className="flex items-end gap-2 rounded-2xl bg-[rgb(var(--vx-cell))] p-1.5 pl-3 focus-within:ring-2 focus-within:ring-[rgb(var(--vx-accent))]">
            <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" aria-label="Message"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm outline-none" style={{ fieldSizing: "content" }} />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))] disabled:opacity-40"><Send size={16} /></button>
          </div>
          <p className={cn("mt-1.5 text-center text-[11px]", muted)}>Answers come from your own data and can be wrong. Ctrl J opens and closes.</p>
        </form>
      </aside>
    </>
  );
}

/** Opens the assistant from anywhere, optionally with a question typed in. */
export const openAssistant = (prompt) => window.dispatchEvent(new CustomEvent("vps-assistant", { detail: { prompt } }));
