// "?" opens this list of keyboard shortcuts.
import React, { useEffect, useState } from "react";
import { Dialog } from "../vx/ui";

const SHORTCUTS = [
  ["Everywhere", [["/", "Search students and scenarios"], ["Ctrl J", "Open the assistant"], ["Ctrl B", "Collapse or expand the sidebar"], ["?", "Show this list"], ["Esc", "Close a dialog or menu"]]],
  ["Scenario editor", [["Ctrl S", "Save"], ["Enter", "Send your request to the AI"], ["Shift Enter", "New line in the AI box"]]],
  ["Students", [["Shift click", "Select a range of rows"]]],
];

const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

export default function ShortcutSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "?" && !typing(document.activeElement)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <Dialog title="Keyboard shortcuts" onClose={() => setOpen(false)} size="sm">
      <div className="flex flex-col gap-5">
        {SHORTCUTS.map(([group, rows]) => (
          <section key={group}>
            <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--vx-muted))]">{group}</h3>
            <ul className="flex flex-col gap-1.5">
              {rows.map(([keys, what]) => (
                <li key={keys} className="flex items-center justify-between gap-4 text-base">
                  <span>{what}</span>
                  <span className="flex gap-1">
                    {keys.split(" ").map((k) => (
                      <kbd key={k} className="min-w-7 rounded-lg border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] px-2 py-0.5 text-center text-sm font-medium shadow-sm">
                        {k === "Ctrl" && isMac ? "⌘" : k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
