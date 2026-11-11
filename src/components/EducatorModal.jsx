// Add or edit an educator, in the vx design. Same onSave payload as before:
// { id, educatorName, emailAddress, department }.
import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button, ButtonGroup, Dialog, InputGroup, InputCell, controlClass } from "./vx/ui";
import { Select } from "./vx/bits";
import { cn } from "../lib/utils";

const DEPARTMENTS = ["Physiotherapy", "Occupational Therapy", "Science", "History", "English", "Mathematics"];

function EducatorModal({ onSave, onClose, educatorData }) {
  const isEdit = !!educatorData;
  const [name, setName] = useState(educatorData?.name || "");
  const [email, setEmail] = useState(educatorData?.email || "");
  const [department, setDepartment] = useState(educatorData?.department || "Physiotherapy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Add the educator's name.");
    if (!/\S+@\S+\.\S+/.test(email)) return setError("That email address doesn't look right.");
    setError("");
    setBusy(true);
    await onSave({ id: educatorData?.id, educatorName: name.trim(), emailAddress: email.trim(), department });
    setBusy(false);
  };

  return (
    <Dialog title={isEdit ? "Edit educator" : "New educator"} onClose={onClose} size="md" z="z-[60]">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <InputGroup vertical>
          <InputCell label="Full name" htmlFor="ed-name">
            <input id="ed-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Marcus Lee" autoComplete="off" className={cn(controlClass, "text-lg")} />
          </InputCell>
          <InputCell label="Email" htmlFor="ed-email">
            <input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.edu" autoComplete="off" className={cn(controlClass, "text-lg")} />
          </InputCell>
          <InputCell as="div" label="Department">
            <Select variant="ghost" label="Department" value={department} onChange={setDepartment} className="-mx-4 w-[calc(100%+2rem)] [&>button]:text-lg"
              options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} />
          </InputCell>
        </InputGroup>
        {error && <p role="alert" className="px-1 text-sm text-[rgb(var(--vx-danger))]">{error}</p>}
        {!isEdit && <p className="px-1 text-sm text-[rgb(var(--vx-muted))]">We email them their login details.</p>}
        <div className="flex justify-end">
          <ButtonGroup>
            <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <><Loader2 className="animate-spin" /> Saving</> : isEdit ? "Save changes" : <><Plus /> Add educator</>}
            </Button>
          </ButtonGroup>
        </div>
      </form>
    </Dialog>
  );
}

export default EducatorModal;
