// Write an email to some students or a whole group, with simple formatting. Each student gets
// their own copy; replies go to the educator. Sends through POST /api/students/message.
// The reach ("Goes to 12 students") shows before and on the confirm step, after ci's class notes.
import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Send, Loader2, Users } from "lucide-react";
import { Button, ButtonGroup, Dialog, InputGroup, InputCell, controlClass } from "../vx/ui";
import RichText from "../vx/RichText";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const signIn = () => `${window.location.origin}/login`;

const TEMPLATES = [
  {
    label: "Practice reminder",
    subject: "Reminder: practise your virtual patient scenarios",
    html: () => `<p>Hi,</p><p>A reminder to practise the scenarios assigned to you on the Virtual Patient Simulator. Each session takes about 15 minutes and you can repeat it as often as you like.</p><p><a href="${signIn()}">Sign in here</a></p>`,
  },
  {
    label: "Before the assessment",
    subject: "Practise before the assessment",
    html: () => `<p>Hi,</p><p>The assessment is coming up. Two things worth practising with the virtual patient:</p><ul><li>Open questions first, then narrow down.</li><li>Screen for red flags every time.</li></ul><p><a href="${signIn()}">Sign in here</a></p>`,
  },
  {
    label: "Well done",
    subject: "Good work on your practice",
    html: () => "<p>Hi,</p><p>I have been reading your sessions. Good work: keep going, and try the harder cases next.</p>",
  },
];

/** `to`: { students: [{ id, name, email }] } or { group: { _id, name, studentCount } }. */
export default function ComposeEmail({ to, onClose, fromName }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = to.group ? to.group.studentCount ?? 0 : to.students.length;
  const reach = `${count} student${count === 1 ? "" : "s"}`;
  const ready = subject.trim() && html.replace(/<[^>]*>/g, "").trim() && count > 0;

  const send = async () => {
    setBusy(true);
    try {
      const body = to.group ? { groupId: to.group._id } : { studentIds: to.students.map((s) => s.id) };
      const { data } = await axios.post("/api/students/message", { ...body, subject, html });
      if (data.failed?.length) toast.error(`Sent to ${data.sent}. ${data.failed.length} could not be sent: ${data.failed.slice(0, 3).map((f) => f.email).join(", ")}`, { duration: 9000 });
      else toast.success(`Sent to ${data.sent} student${data.sent === 1 ? "" : "s"}.`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not send the email.");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={confirm ? "Send this email?" : "Write an email"} onClose={busy ? undefined : onClose} size="md" z="z-[70]"
      subtitle={to.group ? `To everyone in ${to.group.name}` : to.students.length === 1 ? `To ${to.students[0].name}` : `To ${reach}`}
      footer={confirm ? (
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={() => setConfirm(false)} disabled={busy}>Back</Button>
          <Button size="lg" onClick={send} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send to {reach}</Button>
        </ButtonGroup>
      ) : (
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <Button size="lg" onClick={() => setConfirm(true)} disabled={!ready}>Review</Button>
        </ButtonGroup>
      )}>
      {confirm ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-2xl bg-[rgb(var(--vx-accent)/0.12)] px-4 py-3 text-base font-medium">
            <Users size={18} /> Goes to {reach}, each separately. Replies come to you.
          </p>
          {to.students && to.students.length > 0 && (
            <p className={cn("text-sm", muted)}>{to.students.slice(0, 8).map((s) => s.name).join(", ")}{to.students.length > 8 ? ` and ${to.students.length - 8} more` : ""}</p>
          )}
          <div className="rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-4">
            <div className="mb-2 text-base font-semibold">{subject}</div>
            <div className="text-base leading-relaxed [&_a]:text-[rgb(var(--vx-accent-text))] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: html }} />
            <p className={cn("mt-4 text-sm", muted)}>Sent by {fromName || "you"} through the Virtual Patient Simulator.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <span className={cn("self-center text-sm", muted)}>Start from</span>
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" onClick={() => { setSubject(t.subject); setHtml(t.html()); }}
                className="rounded-full bg-[rgb(var(--vx-cell))] px-3 py-1 text-sm transition-colors hover:bg-[rgb(var(--vx-accent)/0.15)]">{t.label}</button>
            ))}
          </div>
          <InputGroup vertical>
            <InputCell label="Subject" htmlFor="mail-subject">
              <input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} autoFocus
                placeholder="e.g. Practise before Friday" className={cn(controlClass, "text-lg")} />
            </InputCell>
          </InputGroup>
          <RichText value={html} onChange={setHtml} placeholder="Write your message…" />
          <p className={cn("text-sm", muted)}>Goes to {reach}, each separately. Replies come to you.</p>
        </div>
      )}
    </Dialog>
  );
}
