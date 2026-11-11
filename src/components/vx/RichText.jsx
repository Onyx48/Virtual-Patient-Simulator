// A small rich-text box for emails: bold, italic, underline, bullet and numbered lists, link.
// contentEditable + execCommand is enough for this; the server keeps only simple tags anyway.
import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from "lucide-react";
import { cn } from "../../lib/utils";

const TOOLS = [
  { cmd: "bold", icon: Bold, label: "Bold (Ctrl+B)" },
  { cmd: "italic", icon: Italic, label: "Italic (Ctrl+I)" },
  { cmd: "underline", icon: Underline, label: "Underline (Ctrl+U)" },
  { cmd: "insertUnorderedList", icon: List, label: "Bullet list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { cmd: "link", icon: Link2, label: "Link" },
  { cmd: "removeFormat", icon: Eraser, label: "Clear formatting" },
];

export default function RichText({ value, onChange, placeholder, minHeight = 180 }) {
  const ref = useRef(null);
  // Only push value into the DOM when it differs, so the caret does not jump while typing.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);

  // Link: remember the selection, ask for the address in a small row, then wrap the selection.
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const saved = useRef(null);
  const run = (cmd) => {
    ref.current?.focus();
    if (cmd === "link") {
      const sel = window.getSelection();
      saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      setUrl("https://");
      setLinking(true);
      return;
    }
    document.execCommand(cmd, false);
    onChange(ref.current.innerHTML);
  };
  const applyLink = () => {
    const href = url.trim();
    setLinking(false);
    if (!/^(https?:\/\/|mailto:)\S+/i.test(href)) return;
    ref.current?.focus();
    const sel = window.getSelection();
    if (saved.current) { sel.removeAllRanges(); sel.addRange(saved.current); }
    if (sel && sel.toString()) document.execCommand("createLink", false, href);
    else document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${href.replace(/</g, "&lt;")}</a>&nbsp;`);
    onChange(ref.current.innerHTML);
  };

  const empty = !String(value || "").replace(/<[^>]*>/g, "").trim();
  return (
    <div className="overflow-hidden rounded-2xl bg-[rgb(var(--vx-cell)/0.6)] focus-within:ring-2 focus-within:ring-[rgb(var(--vx-accent))]">
      <div className="flex flex-wrap gap-0.5 border-b border-[rgb(var(--vx-line)/0.7)] px-2 py-1.5">
        {TOOLS.map(({ cmd, icon: Icon, label }) => (
          <button key={cmd} type="button" title={label} aria-label={label} onMouseDown={(e) => { e.preventDefault(); run(cmd); }}
            className="grid size-8 place-items-center rounded-lg text-[rgb(var(--vx-muted))] transition-colors hover:bg-[rgb(var(--vx-card))] hover:text-[rgb(var(--vx-ink))]">
            <Icon size={16} />
          </button>
        ))}
      </div>
      {linking && (
        <div className="flex items-center gap-2 border-b border-[rgb(var(--vx-line)/0.7)] px-3 py-2">
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinking(false); }}
            className="h-8 flex-1 rounded-lg border-0 bg-[rgb(var(--vx-card))] px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
          <button type="button" onClick={applyLink} className="h-8 rounded-full bg-[rgb(var(--vx-accent))] px-3 text-sm font-medium text-[rgb(var(--vx-on-accent))]">Add link</button>
          <button type="button" onClick={() => setLinking(false)} className="h-8 rounded-full px-3 text-sm text-[rgb(var(--vx-muted))]">Cancel</button>
        </div>
      )}
      <div className="relative">
        {empty && <div className="pointer-events-none absolute left-4 top-3 text-base text-[rgb(var(--vx-muted))]">{placeholder}</div>}
        <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={placeholder}
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          onKeyDown={(e) => { e.stopPropagation(); }}
          className={cn("px-4 py-3 text-base leading-relaxed outline-none [&_a]:text-[rgb(var(--vx-accent-text))] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6")}
          style={{ minHeight }} />
      </div>
    </div>
  );
}
