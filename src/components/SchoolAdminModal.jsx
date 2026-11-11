// Create a school admin, in the vx design. Same payload as before:
// { name, email, role: "school_admin", schoolId }. Shows who it is for before creating.
import React, { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button, ButtonGroup, Dialog, InputGroup, InputCell, controlClass } from "./vx/ui";
import { Select } from "./vx/bits";
import { cn } from "../lib/utils";

function SchoolAdminModal({ onSave, onClose, schools = [] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const school = schools.find((s) => String(s._id) === String(schoolId));

  const review = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Add their name.");
    if (!/\S+@\S+\.\S+/.test(email)) return setError("That email address doesn't look right.");
    if (!schoolId) return setError("Choose the school they run.");
    setError("");
    setConfirm(true);
  };
  const create = async () => {
    setBusy(true);
    await onSave({ name: name.trim(), email: email.trim(), role: "school_admin", schoolId });
    setBusy(false);
  };

  return (
    <Dialog title={confirm ? "Create this school admin?" : "New school admin"} onClose={busy ? undefined : onClose} size="md" z="z-[60]"
      footer={confirm ? (
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={() => setConfirm(false)} disabled={busy}>Back</Button>
          <Button size="lg" onClick={create} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Create and email login</Button>
        </ButtonGroup>
      ) : (
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <Button size="lg" onClick={review}>Review</Button>
        </ButtonGroup>
      )}>
      {confirm ? (
        <div className="flex flex-col gap-2 text-base">
          <p><b>{name}</b> ({email}) will run <b>{school?.schoolName}</b>.</p>
          <p className="text-[rgb(var(--vx-muted))]">They get an email with their login details and can add educators and see the school's results.</p>
        </div>
      ) : schools.length === 0 ? (
        <p className="text-base text-[rgb(var(--vx-muted))]">Every school already has an admin. Add a school first, or change an existing admin from the Schools list.</p>
      ) : (
        <form onSubmit={review} className="flex flex-col gap-3">
          <InputGroup vertical>
            <InputCell label="Full name" htmlFor="sa-name">
              <input id="sa-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Prof. Tan Wei Ling" className={cn(controlClass, "text-lg")} />
            </InputCell>
            <InputCell label="Email" htmlFor="sa-email">
              <input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="name@school.edu" className={cn(controlClass, "text-lg")} />
            </InputCell>
            <InputCell as="div" label="School">
              <Select variant="ghost" label="School" value={schoolId} onChange={setSchoolId} placeholder="Choose a school" className="-mx-4 w-[calc(100%+2rem)] [&>button]:text-lg"
                options={schools.map((s) => ({ value: String(s._id), label: s.schoolName }))} />
            </InputCell>
          </InputGroup>
          {error && <p role="alert" className="px-1 text-sm text-[rgb(var(--vx-danger))]">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      )}
    </Dialog>
  );
}

export default SchoolAdminModal;
