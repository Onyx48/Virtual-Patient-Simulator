// Groups at a glance, with notes on each group (after ci/internal-shortlisting's class notes):
// named authors, the reach shown, only the author removes a note. Students never see them.
import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Users, Mail, Trash2, StickyNote, Loader2, Filter, ArrowRight } from "lucide-react";
import { useNavigate } from "../../lib/router";
import { Button, ButtonGroup, Dialog } from "../vx/ui";
import { Ago } from "../vx/bits";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";

export function GroupNotes({ group, onChanged }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = group.notes || [];
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`/api/groups/${group._id}/notes`, { text });
      onChanged({ ...group, notes: [...notes, data] });
      setText("");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not add the note.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (n) => {
    try {
      await axios.delete(`/api/groups/${group._id}/notes/${n._id}`);
      onChanged({ ...group, notes: notes.filter((x) => x._id !== n._id) });
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not remove the note.");
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {notes.map((n) => (
            <li key={n._id} className="group/note flex items-start gap-2 rounded-xl bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2">
              <StickyNote size={15} className={cn("mt-1 shrink-0", muted)} />
              <span className="min-w-0 flex-1">
                <span className="block whitespace-pre-wrap text-base">{n.text}</span>
                <span className={cn("text-xs", muted)}>{n.authorName || "An educator"} · <Ago date={n.createdAt} /></span>
              </span>
              {n.mine && (
                <button type="button" onClick={() => remove(n)} aria-label="Remove note" title="Remove"
                  className={cn("grid size-7 place-items-center rounded-full opacity-0 transition-opacity hover:bg-[rgb(var(--vx-card))] focus:opacity-100 group-hover/note:opacity-100", muted)}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={`Note about ${group.name}, e.g. "Struggles with red flags; revisit in week 6"`} aria-label={`Note about ${group.name}`}
          className="h-10 min-w-0 flex-1 rounded-full border-0 bg-[rgb(var(--vx-cell))] px-4 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
        <Button variant="secondary" size="sm" className="h-10" onClick={add} disabled={busy || !text.trim()}>{busy ? <Loader2 className="animate-spin" /> : null} Add note</Button>
      </div>
    </div>
  );
}

export default function GroupsPanel({ groups, onGroupsChange, onClose, onShowGroup, onEmailGroup }) {
  const navigate = useNavigate();
  const [list, setList] = useState(groups);
  const update = (g) => {
    const next = list.map((x) => (x._id === g._id ? g : x));
    setList(next);
    onGroupsChange?.(next);
  };
  return (
    <Dialog title="Groups" subtitle="Notes here are for educators only. Students never see them." onClose={onClose} size="lg">
      {list.length === 0 ? (
        <p className={cn("py-8 text-center text-base", muted)}>No groups yet. Make one when you add or edit a student.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((g) => (
            <li key={g._id} className="flex flex-col gap-3 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.18)]"><Users size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{g.name}</span>
                  <span className={cn("text-sm", muted)}>{g.studentCount ?? 0} student{g.studentCount === 1 ? "" : "s"}{g.notes?.length ? ` · ${g.notes.length} note${g.notes.length === 1 ? "" : "s"}` : ""}</span>
                </span>
                <ButtonGroup>
                  <Button size="sm" onClick={() => { onClose(); navigate(`/groups/${g._id}`); }}>Open class <ArrowRight /></Button>
                  <Button variant="secondary" size="sm" onClick={() => onShowGroup(g)}><Filter /> Show students</Button>
                  <Button variant="secondary" size="sm" disabled={!g.studentCount} onClick={() => onEmailGroup(g)}><Mail /> Email group</Button>
                </ButtonGroup>
              </div>
              <GroupNotes group={g} onChanged={update} />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
