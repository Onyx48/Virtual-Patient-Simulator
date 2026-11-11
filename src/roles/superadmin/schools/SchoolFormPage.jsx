// Add or edit a school, in the vx design (mindsets/superadmin.md, V6). Same endpoints and payload as
// before (POST/PUT /api/schools, dates as dd/MM/yyyy). Fixes: editing now loads the description and
// contact email (they were read into differently named fields and saved back blank), and the end
// date follows from start date + duration unless set by hand.
import React, { useEffect, useState } from "react";
import { fetchCached } from "../../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { addMonths, format, isValid, parse, differenceInCalendarDays } from "date-fns";
import { Loader2, Save } from "lucide-react";
import { useNavigate, useParams } from "../../../lib/router";
import { Button, ButtonGroup, InputGroup, InputCell, Section, Segmented, controlClass } from "../../../components/vx/ui";
import { cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const toInput = (d) => (d && isValid(d) ? format(d, "yyyy-MM-dd") : "");
const fromInput = (s) => (s ? parse(s, "yyyy-MM-dd", new Date()) : null);
const fromApi = (v) => {
  if (!v) return null;
  const d = typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v) ? parse(v, "dd/MM/yyyy", new Date()) : new Date(v);
  return isValid(d) ? d : null;
};

export default function SchoolFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  // Editing returns to that school; adding returns to the list.
  const back = isEdit ? `/schools/${id}` : "/schools";
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    schoolName: "", description: "", email: "", duration: "1 Year", subscriptionType: "Basic",
    status: "Active", permissions: "Read Only", startDate: new Date(), endDate: addMonths(new Date(), 12), endTouched: false,
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!isEdit) return;
    fetchCached(`/api/schools/${id}`)
      .then((data) => setF({
        schoolName: data.schoolName || "", description: data.description || "", email: data.email || "",
        duration: data.duration || "1 Year", subscriptionType: data.subscriptionType || "Basic", status: data.status || "Active",
        permissions: data.permissions || "Read Only", startDate: fromApi(data.startDate), endDate: fromApi(data.expireDate), endTouched: true,
      }))
      .catch(() => { toast.error("Could not load this school."); navigate("/schools"); })
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

  // End date follows start + duration until the admin sets it by hand.
  const setStart = (d) => setF((x) => ({ ...x, startDate: d, endDate: x.endTouched || !d ? x.endDate : addMonths(d, x.duration === "6 Months" ? 6 : 12) }));
  const setDuration = (v) => setF((x) => ({ ...x, duration: v, endDate: x.endTouched || !x.startDate ? x.endDate : addMonths(x.startDate, v === "6 Months" ? 6 : 12) }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!f.schoolName.trim()) return setError("Add the school's name.");
    if (f.email && !/\S+@\S+\.\S+/.test(f.email)) return setError("That contact email doesn't look right.");
    if (!f.startDate || !f.endDate) return setError("Set the start and end dates.");
    if (f.endDate < f.startDate) return setError("The end date is before the start date.");
    setError("");
    setSaving(true);
    try {
      const body = {
        schoolName: f.schoolName.trim(), description: f.description, email: f.email.trim(), subscriptionType: f.subscriptionType,
        duration: f.duration, startDate: format(f.startDate, "dd/MM/yyyy"), expireDate: format(f.endDate, "dd/MM/yyyy"),
        status: f.status, permissions: f.permissions,
      };
      if (isEdit) await axios.put(`/api/schools/${id}`, body);
      else await axios.post("/api/schools", body);
      toast.success(isEdit ? "School saved." : "School added.");
      navigate(back);
    } catch (err) {
      toast.error(err.response?.data?.message || `Could not ${isEdit ? "save" : "add"} the school.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={cn("vx flex min-h-full items-center justify-center gap-2 p-10 text-base", muted)}><Loader2 className="animate-spin" size={18} /> Loading school…</div>;

  const days = f.startDate && f.endDate ? differenceInCalendarDays(f.endDate, f.startDate) : null;

  return (
    <div className="vx min-h-full px-4 pb-28 pt-6 md:px-6">
      <form onSubmit={submit} className="flex max-w-4xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{isEdit ? f.schoolName || "Edit school" : "New school"}</h1>

        <Section title="School">
          <div className="flex flex-col gap-0.5">
            <InputGroup>
              <InputCell label="Name" htmlFor="sc-name" className="flex-1">
                <input id="sc-name" autoFocus={!isEdit} value={f.schoolName} onChange={(e) => set("schoolName")(e.target.value)} placeholder="e.g. Singapore Institute of Technology" className={cn(controlClass, "text-xl font-medium")} />
              </InputCell>
              <InputCell label="Contact email" htmlFor="sc-email" className="md:w-96">
                <input id="sc-email" type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="programme@school.edu" className={cn(controlClass, "text-lg")} />
              </InputCell>
            </InputGroup>
            <InputGroup>
              <InputCell label="Short description (optional)" htmlFor="sc-desc" className="flex-1">
                <input id="sc-desc" value={f.description} onChange={(e) => set("description")(e.target.value)} placeholder="e.g. Physiotherapy, years 2 and 3" className={cn(controlClass, "text-lg")} />
              </InputCell>
            </InputGroup>
          </div>
        </Section>

        <Section title="Subscription" hint={days != null && days >= 0 ? `${days} days, ending ${format(f.endDate, "d MMM yyyy")}` : undefined}>
          <div className="flex flex-col gap-0.5">
            <InputGroup>
              <InputCell as="div" label="Plan" className="flex-1">
                <Segmented label="Plan" value={f.subscriptionType} onChange={set("subscriptionType")} options={["Free", "Basic", "Premium"].map((v) => ({ value: v, label: v }))} />
              </InputCell>
              <InputCell as="div" label="Duration" className="md:w-80">
                <Segmented label="Duration" value={f.duration} onChange={setDuration} options={[{ value: "6 Months", label: "6 months" }, { value: "1 Year", label: "1 year" }]} />
              </InputCell>
            </InputGroup>
            <InputGroup>
              <InputCell label="Starts" htmlFor="sc-start" className="flex-1">
                <input id="sc-start" type="date" value={toInput(f.startDate)} onChange={(e) => setStart(fromInput(e.target.value))} className={cn(controlClass, "text-lg")} />
              </InputCell>
              <InputCell label="Ends" htmlFor="sc-end" className="flex-1">
                <input id="sc-end" type="date" value={toInput(f.endDate)} onChange={(e) => setF((x) => ({ ...x, endDate: fromInput(e.target.value), endTouched: true }))} className={cn(controlClass, "text-lg")} />
              </InputCell>
            </InputGroup>
            <InputGroup>
              <InputCell as="div" label="Status" className="flex-1">
                <Segmented label="Status" value={f.status} onChange={set("status")} options={["Active", "Pending", "Expired"].map((v) => ({ value: v, label: v }))} />
              </InputCell>
              <InputCell as="div" label="Permissions" className="flex-1">
                <Segmented label="Permissions" value={f.permissions} onChange={set("permissions")} options={[{ value: "Read Only", label: "Read only" }, { value: "Write Only", label: "Write only" }, { value: "Both", label: "Both" }]} />
              </InputCell>
            </InputGroup>
          </div>
        </Section>

        {error && <p role="alert" className="rounded-2xl bg-[rgb(var(--vx-danger)/0.1)] px-4 py-3 text-base text-[rgb(var(--vx-danger))]">{error}</p>}
      </form>

      <div className="fixed bottom-6 right-6 z-40 rounded-full border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-bg)/0.95)] p-1.5 shadow-lg backdrop-blur">
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={() => navigate(back)} disabled={saving}>Cancel</Button>
          <Button size="lg" onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} {isEdit ? "Save school" : "Add school"}</Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
