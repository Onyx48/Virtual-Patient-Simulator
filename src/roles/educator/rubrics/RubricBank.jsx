// Rubric bank (after ci/internal-shortlisting's question bank): paste an existing OSCE checklist,
// the AI splits it into grading questions, approve them, and reuse them as scenarios' feedback
// questions. /api/rubrics. The picker below is used by the scenario editor.
import React, { useEffect, useMemo, useState } from "react";
import { useCached } from "../../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Sparkles, Loader2, Trash2, Save, ClipboardPaste, Check } from "lucide-react";
import { Button, ButtonGroup, Dialog, Section } from "../../../components/vx/ui";
import { ListToolbar, Paged } from "../../../components/vx/list";
import { Select, Tick, copyText } from "../../../components/vx/bits";
import { getAuthHeaders, cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const cell = "w-full rounded-xl border-0 bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]";

function useBank() {
  const [items, setItems, load] = useCached("/api/rubrics", { fallback: [] });
  return [items, setItems, load];
}

export default function RubricBank() {
  const [items, setItems, load] = useBank();
  const [paste, setPaste] = useState("");
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState(null); // [{ text, criterion, keep }]
  const [via, setVia] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [criterion, setCriterion] = useState("");

  const split = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post("/api/rubrics/parse", { text: paste }, getAuthHeaders());
      setDraft(data.items.map((i) => ({ ...i, keep: true })));
      setVia(data.via);
      if (!data.items.length) toast("Nothing recognisable in that text.");
    } catch (e) { toast.error(e.response?.data?.message || "Could not split that."); } finally { setBusy(false); }
  };
  const save = async () => {
    const keep = draft.filter((d) => d.keep && d.text.trim());
    if (!keep.length) return;
    setBusy(true);
    try {
      await axios.post("/api/rubrics", { items: keep, source }, getAuthHeaders());
      toast.success(`Saved ${keep.length} question${keep.length === 1 ? "" : "s"} to your bank.`);
      setDraft(null); setPaste(""); setSource(""); load();
    } catch (e) { toast.error(e.response?.data?.message || "Could not save."); } finally { setBusy(false); }
  };
  const remove = async (it) => {
    try { await axios.delete(`/api/rubrics/${it._id}`, getAuthHeaders()); setItems((l) => l.filter((x) => x._id !== it._id)); }
    catch (e) { toast.error(e.response?.data?.message || "Could not delete."); }
  };

  const criteria = useMemo(() => [...new Set((items || []).map((i) => i.criterion).filter(Boolean))].sort(), [items]);
  const shown = (items || []).filter((i) => (!criterion || i.criterion === criterion) && (!search.trim() || i.text.toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">Rubric bank {items?.length > 0 && <span className={cn("tabular-nums", muted)}>{items.length}</span>}</h1>
          <p className={cn("max-w-3xl text-base", muted)}>Paste a checklist you already use (an OSCE marking sheet, a history-taking rubric). It is split into grading questions you can reuse in any scenario.</p>
        </header>

        <Section title={draft ? `Review ${draft.length} questions` : "Add from a checklist"}
          hint={draft ? (via === "ai" ? "Split by AI. Edit anything, untick what you don't want." : "No AI available, so split by line. Edit as needed.") : undefined}>
          {!draft ? (
            <div className="flex flex-col gap-3">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} placeholder={"History of presenting complaint:\n1. Asks about onset and mechanism\n2. Asks about 24-hour pattern\nRed flags:\n3. Screens for saddle anaesthesia and bladder changes"} className={cell} />
              {/* Joined: the source field and the action */}
              <div className="vx-join w-full">
                <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Where it is from (optional), e.g. Year 2 OSCE 2025" className={cn(cell, "h-11 min-w-0 flex-1 py-0")} />
                <Button onClick={split} disabled={busy || !paste.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Split into questions</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                {draft.map((d, i) => (
                  <li key={i} className={cn("flex items-start gap-3 rounded-xl p-2", !d.keep && "opacity-50")}>
                    <Tick className="mt-2.5" label="Keep" checked={d.keep} onChange={() => setDraft((x) => x.map((y, j) => (j === i ? { ...y, keep: !y.keep } : y)))} />
                    <input value={d.text} onChange={(e) => setDraft((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))} className={cn(cell, "flex-1")} aria-label="Question" />
                    <input value={d.criterion} onChange={(e) => setDraft((x) => x.map((y, j) => (j === i ? { ...y, criterion: e.target.value } : y)))} placeholder="Section" className={cn(cell, "w-56")} aria-label="Section" />
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <ButtonGroup>
                  <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>Back</Button>
                  <Button onClick={save} disabled={busy || !draft.some((d) => d.keep)}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Save {draft.filter((d) => d.keep).length}</Button>
                </ButtonGroup>
              </div>
            </div>
          )}
        </Section>

        <ListToolbar
          search={{ value: search, onChange: setSearch, placeholder: "Search your questions" }}
          filters={criteria.length > 1 && (
            <div className="px-1"><Select variant="ghost" label="Section" value={criterion} onChange={setCriterion} options={[{ value: "", label: "All sections" }, ...criteria.map((c) => ({ value: c, label: c }))]} /></div>
          )}
        />

        {items === null ? <div className="h-40 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" /> : shown.length === 0 ? (
          <p className={cn("rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] px-5 py-12 text-center text-base", muted)}>
            {items.length ? "No questions match." : "Your bank is empty. Paste a checklist above to start."}
          </p>
        ) : <Paged rows={shown} size={32} sizes={[32, 64, 128]}>{(page) => Object.entries(page.reduce((m, i) => { (m[i.criterion || "Other"] ||= []).push(i); return m; }, {})).map(([c, list]) => (
          <section key={c} className="rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5">
            <h2 className="mb-2 text-lg font-semibold">{c} <span className={cn("text-sm font-normal", muted)}>· {list.length}</span></h2>
            <ul className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {list.map((it) => (
                <li key={it._id} className="group/r flex items-center gap-3 py-2">
                  <span className="flex-1 text-base">{it.text}</span>
                  {it.timesUsed > 0 && <span className={cn("text-xs", muted)}>used {it.timesUsed}×</span>}
                  <button type="button" onClick={() => copyText(it.text, "Copied")} className={cn("text-sm opacity-0 hover:text-[rgb(var(--vx-ink))] group-hover/r:opacity-100", muted)}>Copy</button>
                  <button type="button" onClick={() => remove(it)} aria-label="Delete" className={cn("grid size-8 place-items-center rounded-full opacity-0 hover:bg-[rgb(var(--vx-cell))] group-hover/r:opacity-100", muted)}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </section>
        ))}</Paged>}
      </div>
    </div>
  );
}

/** Pick questions from the bank; onAdd(texts) appends them where the caller wants. */
export function RubricPicker({ onAdd, onClose }) {
  const [items] = useBank();
  const [picked, setPicked] = useState({});
  const [q, setQ] = useState("");
  const shown = (items || []).filter((i) => !q.trim() || `${i.text} ${i.criterion}`.toLowerCase().includes(q.trim().toLowerCase()));
  const ids = Object.keys(picked).filter((k) => picked[k]);
  const add = () => {
    const chosen = (items || []).filter((i) => picked[i._id]);
    onAdd(chosen.map((i) => i.text));
    axios.post("/api/rubrics/used", { ids }, getAuthHeaders()).catch(() => {});
    onClose();
  };
  return (
    <Dialog title="Add from your rubric bank" onClose={onClose} size="lg" z="z-[60]"
      footer={<ButtonGroup><Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button><Button size="lg" onClick={add} disabled={!ids.length}><Check /> Add {ids.length || ""}</Button></ButtonGroup>}>
      <div className="flex flex-col gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search" className={cn(cell, "h-11 py-0")} />
        {items === null ? <Loader2 className="animate-spin" /> : !items.length ? (
          <p className={cn("text-base", muted)}><ClipboardPaste className="mr-1 inline" size={16} /> Your bank is empty. Add a checklist on the Rubric bank page first.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shown.map((i) => (
              <li key={i._id}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2", picked[i._id] ? "bg-[rgb(var(--vx-accent)/0.12)]" : "hover:bg-[rgb(var(--vx-cell)/0.6)]")}>
                  <Tick className="mt-0.5" label="Pick" checked={!!picked[i._id]} onChange={() => setPicked((p) => ({ ...p, [i._id]: !p[i._id] }))} />
                  <span className="flex-1 text-base">{i.text}{i.criterion && <span className={cn("block text-sm", muted)}>{i.criterion}</span>}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
