import React from "react";
import { Button, ButtonGroup, Dialog } from "../vx/ui";

/** Same props as before. `danger` tints the confirm button red; `confirmLabel` renames it. */
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger }) {
  if (!isOpen) return null;
  const destructive = danger ?? /delete|remove/i.test(`${title} ${confirmLabel}`);
  return (
    <Dialog title={title} onClose={onClose} size="sm" z="z-[60]"
      footer={
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} size="lg" onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        </ButtonGroup>
      }>
      <p className="text-base text-[rgb(var(--vx-muted))]">{message}</p>
    </Dialog>
  );
}

export default ConfirmationModal;
