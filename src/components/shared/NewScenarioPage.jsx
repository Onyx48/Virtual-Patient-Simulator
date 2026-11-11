// New / edit scenario as a full page, after internal-shortlisting's "New opening"
// (docs/NEW_SCENARIO_UX.md). Same endpoints and payload as ScenarioFormPage.jsx.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "../../lib/router";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import toast from "react-hot-toast";
import { Sparkles, Loader, Undo2, Trash2, History, Copy, Play, Lock } from "lucide-react";
import { copyText, Ago } from "../vx/bits";
import { RubricPicker } from "../../roles/educator/rubrics/RubricBank";
import { ListChecks } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { addScenario, updateScenario, deleteScenario, fetchScenarios } from "../../redux/slices/scenarioSlice.js";
import ConfirmationModal from "../ui/ConfirmationModal";
import MovementPicker from "./MovementPicker";
import { REGIONS, emptyMovements, formatMovementsForBackend, processIncomingMovements, AI_STAGES } from "./ScenarioFormPage";
import { Button, ButtonGroup, Segmented, InputGroup, InputCell, AutoTextarea, Expand, Section, controlClass } from "../vx/ui";
import { cn } from "../../lib/utils";


const STAGE_SECONDS = 6;

// Stored prompts and questions are HTML from the old rich-text editor; the page edits plain text.
const htmlToText = (html) => {
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) return html || "";
  const div = document.createElement("div");
  div.innerHTML = html.replace(/<\/(p|li|h\d|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<li>/gi, "• ");
  return (div.textContent || "").split(String.fromCharCode(160)).join(" ").replace(/\n{3,}/g, "\n\n").trim();
};
// The scenario prompt is edited as two parts and stored as one text with these headings.
// One-click requests for the AI box, once a case exists (M1: fewer keystrokes per tweak).
const SUGGESTIONS = [
  "Make them more anxious about work",
  "Add a red flag the student should catch",
  "Make them 15 years older",
  "Make them less talkative; short answers unless asked open questions",
  "Add a belief in traditional remedies",
  "Make the pain worse at night",
];
const wordCount = (t) => (String(t || "").trim().match(/\S+/g) || []).length;

const PROFILE_HEAD = "## Patient profile";
const CASE_HEAD = "## Case";
// Sections of the AI's case that describe the person rather than the condition.
const PROFILE_LABELS = /^(patient profile|social history|life (and|&) social history)$/i;
const LABEL_LINE = /^[\s*#>-]*\**\s*([A-Za-z' &]+?)\s*:?\**\s*:/;
const KNOWN = /^(physiotherapy case|occupational therapy case|patient profile|history of present illness|medical history|social history|life (and|&) social history|relevant investigations|previous treatment|simulated physical examination findings|patient.s aim and goals of treatment|simulation objectives for student)$/i;

const NL = String.fromCharCode(10);
const splitPrompt = (text) => {
  const t = String(text || "").trim();
  if (!t) return { profile: "", caseText: "" };
  if (t.startsWith(PROFILE_HEAD) && t.includes(NL + CASE_HEAD)) {
    const [p, c] = t.slice(PROFILE_HEAD.length).split(NL + CASE_HEAD);
    return { profile: p.trim(), caseText: c.trim() };
  }
  // AI output: walk the labelled sections; profile and social history go to the profile.
  const profile = [], rest = [];
  let into = rest;
  for (const line of t.split(NL)) {
    if (/^---/.test(line.trim())) into = rest;
    const m = line.match(LABEL_LINE);
    if (m && KNOWN.test(m[1].trim())) into = PROFILE_LABELS.test(m[1].trim()) ? profile : rest;
    into.push(line);
  }
  return profile.length
    ? { profile: profile.join(NL).trim(), caseText: rest.join(NL).trim() }
    : { profile: "", caseText: t };
};
const joinPrompt = (profile, caseText) =>
  [PROFILE_HEAD, String(profile || "").trim(), "", CASE_HEAD, String(caseText || "").trim()].join(NL);
const FIELD_LABELS = {
  scenarioName: "Scenario name", difficulty: "Difficulty", profession: "Profession", locale: "Patient setting",
  shortDescription: "One-line summary", profile: "Patient profile", caseText: "Case",
  learningObjectives: "Learning objectives", questionsForFeedback: "Feedback questions", movements: "Movement restrictions",
};
const shown = (k, x) =>
  k === "locale" ? (x === "sg" ? "Singapore" : "General")
    : k === "profession" ? (x === "occupational_therapy" ? "OT" : "PT")
    : k === "difficulty" && x === "High" ? "Hard" : String(x ?? "");
const NLC = String.fromCharCode(10);
const lineSet = (t) => String(t || "").split(NLC).map((l) => l.trim()).filter(Boolean);

/** Field-by-field changes from `base` to `cur`; long texts as removed and added lines. */
const diffValues = (base, cur) => {
  const out = [];
  for (const k of Object.keys(FIELD_LABELS)) {
    if (k === "movements") {
      const was = Object.values(formatMovementsForBackend(base.movements)).flat();
      const now = Object.values(formatMovementsForBackend(cur.movements)).flat();
      const added = now.filter((x) => !was.includes(x)), removed = was.filter((x) => !now.includes(x));
      if (added.length || removed.length) out.push({ field: k, label: FIELD_LABELS[k], removed, added,
        summary: [removed.length && `removed ${removed.join(", ")}`, added.length && `set ${added.join(", ")}`].filter(Boolean).join("; ") });
      continue;
    }
    const a = shown(k, base[k]).trim(), b = shown(k, cur[k]).trim();
    if (a === b) continue;
    if (a.length < 120 && b.length < 120 && !a.includes(NLC) && !b.includes(NLC)) {
      out.push({ field: k, label: FIELD_LABELS[k], from: a, to: b, summary: `"${a || "empty"}" → "${b || "empty"}"` });
    } else {
      const A = lineSet(a), B = lineSet(b);
      const removed = A.filter((l) => !B.includes(l)), added = B.filter((l) => !A.includes(l));
      if (!removed.length && !added.length) continue;
      out.push({ field: k, label: FIELD_LABELS[k], removed, added,
        summary: [removed.length && `${removed.length} line${removed.length === 1 ? "" : "s"} removed`, added.length && `${added.length} added or rewritten`].filter(Boolean).join(", ") });
    }
  }
  return out;
};

/** The request sent to the AI once a case exists: the scenario as it stands now, what the
 *  educator changed by hand since the AI's last version, earlier requests, and the new one. */
const editBrief = ({ current, edits, history, instruction }) => {
  const parts = [
    "Revise the existing scenario below. Keep everything that the new request does not ask to change, and keep every part consistent with every other (scenario name, patient profile, case, objectives and questions must agree on age, sex, occupation, side and condition).",
    "",
    "=== CURRENT SCENARIO (includes the educator's own edits; treat it as the source of truth) ===",
    `Scenario name: ${current.scenarioName || ""}`,
    `Profession: ${shown("profession", current.profession)} | Patient setting: ${shown("locale", current.locale)} | Difficulty: ${shown("difficulty", current.difficulty)}`,
    "", "Patient profile:", current.profile || "", "", "Case:", current.caseText || "",
    "", "Learning objectives:", current.learningObjectives || "",
    "", "Feedback questions:", current.questionsForFeedback || "",
  ];
  if (edits.length) {
    parts.push("", "=== CHANGES THE EDUCATOR MADE BY HAND SINCE YOUR LAST VERSION (keep them) ===");
    for (const e of edits) {
      if (e.from !== undefined) parts.push(`- ${e.label}: changed from "${e.from}" to "${e.to}"`);
      else {
        parts.push(`- ${e.label}:`);
        e.removed.forEach((l) => parts.push(`    removed: ${l}`));
        e.added.forEach((l) => parts.push(`    added: ${l}`));
      }
    }
  }
  if (history.length) {
    parts.push("", "=== EARLIER REQUESTS (already applied) ===");
    history.forEach((h, i) => parts.push(`${i + 1}. ${h}`));
  }
  parts.push("", "=== NEW REQUEST ===", instruction);
  return parts.join(NLC);
};
const linesToList = (text) => {
  const items = String(text || "").split("\n").map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim()).filter(Boolean);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return items.length ? `<ul>${items.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : "";
};
const textToHtml = (text) =>
  String(text || "").split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("");

const muted = "text-[rgb(var(--vx-muted))]";

export default function NewScenarioPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { scenarios } = useSelector((s) => s.scenarios);
  const isEdit = !!id;
  const scenario = id ? scenarios.find((s) => s._id === id || s.id === id) : null;
  const isSuperadmin = user?.role === "superadmin";

  const { register, setValue, getValues, control, reset } = useForm({
    defaultValues: {
      scenarioName: "", difficulty: "Medium", environment: "", avatarModel: "", status: "Draft",
      shortDescription: "", movements: emptyMovements(), profile: "", caseText: "",
      questionsForFeedback: "", learningObjectives: "",
      profession: user?.schoolId?.defaultProfession || "physiotherapy", locale: "sg",
    },
  });
  const v = useWatch({ control });

  const [apiKey, setApiKey] = useState("");
  const [patientInfo, setPatientInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiInput, setAiInput] = useState("");
  // Sections fold. Until the AI has written a case they start folded; the educator can open or close any of them.
  const [folds, setFolds] = useState({});
  const isOpen = (k) => folds[k] ?? (k === "learn" ? false : hasCase || isEdit);
  const toggle = (k) => setFolds((f) => ({ ...f, [k]: !isOpen(k) }));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiElapsed, setAiElapsed] = useState(0);
  const [undo, setUndo] = useState(null); // { label, snapshot }
  // What the AI last produced (or what was loaded). Anything the educator changes after
  // that is diffed against it and sent with the next AI request, so the AI keeps context.
  const aiBase = useRef(null);
  const [aiHistory, setAiHistory] = useState([]); // earlier instructions, oldest first
  const [showEdits, setShowEdits] = useState(false);
  const savedRef = useRef(null); // JSON of the form as last loaded or saved
  // Versions in this sitting: each AI change and each save, newest first; any can be restored.
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const addVersion = (label, snap) => setVersions((list) => [{ label, at: new Date(), snap }, ...list].slice(0, 30));
  const [testing, setTesting] = useState(false);
  const [pickRubric, setPickRubric] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (isEdit && !scenario) dispatch(fetchScenarios());
  }, [isEdit, scenario, dispatch]);

  useEffect(() => {
    if (!isEdit || !scenario) return;
    setApiKey(scenario.apiKey || "");
    setPatientInfo({ patientName: scenario.patientName || "", patientGender: scenario.patientGender || "", language: scenario.language || "" });
    reset({
      ...getValues(),
      scenarioName: scenario.scenarioName || "",
      difficulty: scenario.difficulty || "Medium",
      environment: scenario.environment || "",
      avatarModel: scenario.avatarModel || "",
      status: scenario.status || "Draft",
      shortDescription: scenario.description || scenario.shortDescription || "",
      ...splitPrompt(htmlToText(scenario.scenarioPrompt)),
      questionsForFeedback: htmlToText(scenario.aiQuestions || scenario.questionsForFeedback),
      learningObjectives: scenario.learningObjectives || "",
      profession: scenario.profession || "physiotherapy",
      locale: scenario.locale || "",
      movements: processIncomingMovements(scenario.animationTriggers || scenario.movements),
    });
    aiBase.current = getValues();
    savedRef.current = JSON.stringify(getValues());
  }, [isEdit, scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aiBusy) return undefined;
    const t = setInterval(() => setAiElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [aiBusy]);

  const nameOk = !!String(v.scenarioName || "").trim();
  const hasCase = !!String(v.caseText || "").trim() || !!String(v.profile || "").trim();
  const beamGenerate = !aiBusy && !!aiInput.trim();
  const caseOk = hasCase;
  const guide = !caseOk ? "ai" : !nameOk ? "name" : null;
  const edits = aiBase.current ? diffValues(aiBase.current, v) : [];
  const ready = nameOk && caseOk;
  // A published scenario is locked: students may be mid-practice on it. Unpublish to change it.
  const [unlocked, setUnlocked] = useState(false);
  const locked = isEdit && scenario?.status === "Published" && !unlocked;
  const mainLabel = !caseOk ? "Generate the case first" : !nameOk ? "Add a name" : isEdit ? "Save changes" : "Create scenario";

  const objectives = String(v.learningObjectives || "").split("\n").filter((l) => l.trim()).length;
  const questions = String(v.questionsForFeedback || "").split("\n").filter((l) => l.trim()).length;
  const restricted = useMemo(
    () => Object.values(v.movements || {}).reduce((n, r) => n + Object.values(r || {}).filter((x) => x && x !== "Full").length, 0),
    [v.movements],
  );

  const snapshot = () => getValues();
  const doUndo = () => {
    setUndo((u) => { if (u) reset(u.snapshot); return null; });
  };

  const generate = async () => {
    const instruction = aiInput.trim();
    if (!instruction) return toast.error(hasCase ? "Say what to change." : "Describe the patient in a few words.");
    const before = snapshot();
    const name = String(before.scenarioName || "").trim();
    const nameIsMine = !hasCase && !!name; // first run only; on edits the AI sees the name and keeps it in step
    const prompt = hasCase
      ? editBrief({ current: before, edits: aiBase.current ? diffValues(aiBase.current, before) : [], history: aiHistory, instruction })
      : instruction;
    setAiElapsed(0);
    setAiBusy(true);
    try {
      const existing = apiKey || scenario?.apiKey || null;
      const { data } = await axios.post(hasCase ? "/api/scenarios/ai/edit" : "/api/scenarios/ai/generate", {
        scenario_prompt: prompt, profession: getValues("profession"), locale: getValues("locale"),
        ...(existing && { api_key: existing }),
      });
      const r = data.response || data;
      if (r.scenario_name) { setValue("scenarioName", r.scenario_name); setValue("shortDescription", r.scenario_name); }
      if (r.difficulty_level) setValue("difficulty", r.difficulty_level === "High" ? "High" : r.difficulty_level);
      if (r.api_key) setApiKey(r.api_key);
      setPatientInfo({ patientName: r.patient_name || "", patientGender: r.patient_gender || "", language: r.language || "" });
      if (r.scenario_prompt) { const parts = splitPrompt(htmlToText(r.scenario_prompt)); setValue("profile", parts.profile); setValue("caseText", parts.caseText); }
      if (Array.isArray(r.questions_for_feedback)) setValue("questionsForFeedback", r.questions_for_feedback.join("\n"));
      else if (r.questions_for_feedback) setValue("questionsForFeedback", htmlToText(r.questions_for_feedback));
      if (Array.isArray(r.learning_objectives) && r.learning_objectives.length) setValue("learningObjectives", r.learning_objectives.join("\n"));
      if (nameIsMine) setValue("scenarioName", name); // a name the educator typed wins
      aiBase.current = getValues();
      setAiHistory((h) => [...h, instruction]);
      setUndo({ label: "the AI", snapshot: before });
      if (!versions.length) addVersion("Before the AI", before);
      addVersion(`AI: ${instruction}`, getValues());
      setAiInput("");
      toast.success(hasCase ? "Case updated." : "Case written. Read it through.");
    } catch (error) {
      toast.error(`AI could not write the case: ${error.response?.data?.message || error.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const payload = (status) => {
    const d = getValues();
    return {
      ...d, status, profile: undefined, caseText: undefined,
      description: d.shortDescription || d.scenarioName,
      scenarioPrompt: textToHtml(joinPrompt(d.profile, d.caseText)),
      questionsForFeedback: linesToList(d.questionsForFeedback),
      aiQuestions: linesToList(d.questionsForFeedback),
      animationTriggers: formatMovementsForBackend(d.movements),
      ...(apiKey && { apiKey }),
      ...patientInfo,
    };
  };

  const save = async (status, { stay = false } = {}) => {
    setSaving(true);
    try {
      if (isEdit) await dispatch(updateScenario({ id, updates: payload(status) })).unwrap();
      else await dispatch(addScenario(payload(status))).unwrap();
      savedRef.current = JSON.stringify(getValues());
      addVersion(status === "Published" ? "Saved and published" : "Saved", getValues());
      if (stay && isEdit) {
        toast.success("Saved.", { duration: 1500 });
        return;
      }
      toast.success(status === "Published" ? "Scenario published." : "Saved as a draft.");
      navigate("/scenarios");
    } catch (err) {
      if (status === "Published") {
        try {
          if (isEdit) await dispatch(updateScenario({ id, updates: payload("Draft") })).unwrap();
          else await dispatch(addScenario(payload("Draft"))).unwrap();
          toast(`Could not publish (${err?.message || err}). Saved as a draft, nothing is lost.`, { duration: 7000 });
          navigate("/scenarios");
          return;
        } catch { /* fall through */ }
      }
      toast.error(`Could not save: ${err?.message || err}. Your work is still here.`);
    } finally {
      setSaving(false);
    }
  };

  // Unsaved: an edit that differs from what was loaded/saved, or a new scenario with anything in it.
  const dirty = !saving && (isEdit ? savedRef.current != null && JSON.stringify(v) !== savedRef.current : nameOk || hasCase);

  // Refresh or closing the tab with unsaved work asks first (the browser shows its own wording).
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Ctrl+S / Cmd+S saves. Editing: in place, keeping the status. New: as a draft (needs a name).
  const saveRef = useRef(null);
  saveRef.current = () => {
    if (saving || aiBusy) return;
    if (isEdit) save(v.status || "Draft", { stay: true });
    else if (nameOk) save("Draft");
    else toast("Add a name first, then save.", { duration: 2000 });
  };
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Leaving a new scenario keeps it as a draft once it has a name (same rule as the old form).
  // Leaving an edit with changes asks first.
  const cancel = async () => {
    if (isEdit && dirty) return setConfirmLeave(true);
    if (isEdit || !nameOk || saving) return navigate("/scenarios");
    await save("Draft");
  };

  const testIt = async () => {
    if (dirty) { toast("Save first (Ctrl+S); the simulator runs the saved version.", { duration: 3000 }); return; }
    setTesting(true);
    try {
      const { data } = await axios.post("/api/scenarios/json", { scenarioId: id });
      if (!data?.simulatorUrl) throw new Error("The server did not say where the simulator is.");
      window.open(data.simulatorUrl, "_blank", "noopener");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Could not open the simulator.");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setSaving(true);
    try { await dispatch(deleteScenario(id)).unwrap(); navigate("/scenarios"); }
    catch (err) { toast.error(err?.message || "Failed to delete."); setSaving(false); }
  };

  const aiStage = AI_STAGES[Math.min(Math.floor(aiElapsed / STAGE_SECONDS), AI_STAGES.length - 1)];
  const nameField = register("scenarioName");
  const setText = (k) => (e) => setValue(k, e.target.value, { shouldDirty: true });

  if (isEdit && !scenario) {
    return <div className="vx flex min-h-full items-center justify-center gap-2 p-10"><Loader className="animate-spin" size={18} /> Loading scenario…</div>;
  }

  return (
    <div className="vx min-h-full px-4 pb-28 pt-6 md:px-6">
      <ConfirmationModal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove}
        title="Delete this scenario?" message="Students will lose access to it. This cannot be undone." />
      <ConfirmationModal isOpen={confirmLeave} onClose={() => setConfirmLeave(false)} confirmLabel="Discard changes" danger
        onConfirm={() => { setConfirmLeave(false); savedRef.current = JSON.stringify(v); navigate("/scenarios"); }}
        title="Leave without saving?" message="Your changes to this scenario since the last save will be lost. Press Ctrl+S to save instead." />

      <div className="flex w-full flex-col gap-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{isEdit ? "Edit scenario" : "New scenario"}</h1>
          </div>
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={saving}><Trash2 /> Delete</Button>
          )}
        </header>

        {locked && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[rgb(var(--vx-ok)/0.35)] bg-[rgb(var(--vx-ok)/0.06)] px-5 py-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[rgb(var(--vx-ok)/0.15)] text-[rgb(var(--vx-ok))]"><Lock size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">Published, so it is locked</p>
              <p className={cn("text-base", muted)}>Students practise this exact case. To change it, unpublish it first (it goes back to draft and students stop seeing it until you publish again).</p>
            </div>
            <Button variant="secondary" size="lg" disabled={saving} onClick={async () => { await save("Draft", { stay: true }); setUnlocked(true); setValue("status", "Draft"); }}>Unpublish to edit</Button>
          </div>
        )}

        {!locked && <section className={cn("sticky top-2 z-30 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5 shadow-lg md:p-6", aiBusy && "vx-beam")}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={20} className="text-[rgb(var(--vx-accent-text))]" />
            <h2 className="text-2xl font-semibold tracking-tight">{hasCase ? "Ask the AI for changes" : "Describe the patient"}</h2>
          </div>
          <InputGroup>
            <div className={cn("flex min-h-16 flex-1 items-center gap-3 rounded-2xl bg-[rgb(var(--vx-cell)/0.6)] py-2 pl-5 pr-2 transition-[background-color,box-shadow] focus-within:bg-[rgb(var(--vx-cell))] focus-within:ring-2 focus-within:ring-[rgb(var(--vx-accent))]", guide === "ai" && "bg-[rgb(var(--vx-accent)/0.05)] ring-2 ring-[rgb(var(--vx-accent)/0.4)]")}>
              <AutoTextarea id="sc-ai" aria-label={hasCase ? "What should change?" : "Describe the patient"} autoFocus={!isEdit} minPx={36} maxVh={30} rows={1} value={aiInput} disabled={aiBusy}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!aiBusy) generate(); } }}
                placeholder={hasCase ? "What should change? e.g. make her more anxious about work, add night pain" : "e.g. 50s hawker, right shoulder pain lifting the wok, worried about losing income"}
                className="py-1 text-xl leading-snug" />
              <span className={cn("rounded-[24px]", beamGenerate && "vx-beam")}>
                <Button size="lg" variant={beamGenerate ? "default" : "soft"} onClick={generate} disabled={aiBusy || !aiInput.trim()}>
                  <Sparkles /> {hasCase ? "Update" : "Generate"}
                </Button>
              </span>
            </div>
          </InputGroup>
          <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-base">
            {aiBusy ? (
              <span className="vx-ai-text font-medium" role="status" aria-live="polite">{aiStage}…</span>
            ) : undo ? (
              <button type="button" onClick={doUndo} className={cn("inline-flex items-center gap-1 font-medium", muted)}>
                <Undo2 size={14} /> Changed by the AI. Undo
              </button>
            ) : hasCase ? <span className={muted}>Or edit anything below yourself. The AI is told what you changed.</span> : <span />}
            {edits.length > 0 && !aiBusy && (
              <button type="button" onClick={() => setShowEdits(!showEdits)} className="font-medium text-[rgb(var(--vx-accent-text))]">
                {edits.length} change{edits.length === 1 ? "" : "s"} by you since the AI's version {showEdits ? "▴" : "▾"}
              </button>
            )}
          </div>
          {hasCase && !aiBusy && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((t) => (
                <button key={t} type="button" onClick={() => { setAiInput(t); document.getElementById("sc-ai")?.focus(); }}
                  className="rounded-full bg-[rgb(var(--vx-cell))] px-3 py-1 text-sm transition-colors hover:bg-[rgb(var(--vx-accent)/0.15)]">
                  {t}
                </button>
              ))}
            </div>
          )}
          {versions.length > 0 && !aiBusy && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowVersions((o) => !o)} className={cn("inline-flex items-center gap-1.5 text-sm font-medium hover:text-[rgb(var(--vx-ink))]", muted)}>
                <History size={15} /> {versions.length} version{versions.length === 1 ? "" : "s"} this session {showVersions ? "▴" : "▾"}
              </button>
              <Expand open={showVersions}>
                <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-[rgb(var(--vx-cell)/0.6)] p-2">
                  {versions.map((x, i) => (
                    <li key={x.at.getTime() + x.label} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{x.label}</span>
                      <span className={cn("text-xs", muted)}><Ago date={x.at} /></span>
                      {i > 0 && (
                        <Button variant="secondary" size="sm" onClick={() => { addVersion("Before restoring", getValues()); reset(x.snap); toast.success("Restored. Save to keep it."); }}>
                          Restore
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Expand>
            </div>
          )}
          <Expand open={showEdits && edits.length > 0}>
            <ul className="mt-3 flex flex-col gap-1.5 rounded-xl bg-[rgb(var(--vx-cell)/0.6)] p-3 text-sm">
              {edits.map((e) => (
                <li key={e.field}><span className="font-medium">{e.label}:</span> <span className={muted}>{e.summary}</span></li>
              ))}
            </ul>
          </Expand>
        </section>}

        <fieldset disabled={locked} className={cn("contents", locked && "[&_section]:opacity-80")}>
        <Section title="Patient" open={isOpen("patient")} onToggle={() => toggle("patient")}>
          <Expand open={isOpen("patient")}>
          <InputGroup>
            <InputCell label="Scenario name" guide={guide === "name"} className="flex-1" htmlFor="sc-name"
              >
              <input id="sc-name" {...nameField} autoComplete="off"
                placeholder="e.g. Hawker with shoulder pain" className={cn(controlClass, "text-2xl font-medium")} />
            </InputCell>
            <InputCell as="div" label="Profession" className="md:w-72">
              <Segmented label="Profession" value={v.profession} onChange={(x) => setValue("profession", x)}
                options={[{ value: "physiotherapy", label: "PT" }, { value: "occupational_therapy", label: "OT" }]} />
            </InputCell>
            <InputCell as="div" label="Patient setting" className="md:w-80">
              <Segmented label="Setting" value={v.locale} onChange={(x) => setValue("locale", x)}
                options={[{ value: "sg", label: "Singapore" }, { value: "", label: "General" }]} />
            </InputCell>
          </InputGroup>
          <div className="mt-0.5">
            <InputGroup>
              <InputCell as="div" label="Difficulty" className="md:w-[26rem]">
                <Segmented label="Difficulty" value={v.difficulty} onChange={(x) => setValue("difficulty", x)}
                  options={[{ value: "Easy", label: "Easy" }, { value: "Medium", label: "Medium" }, { value: "High", label: "Hard" }]} />
              </InputCell>
              <InputCell label="One-line summary (optional)" className="flex-1" htmlFor="sc-desc">
                <input id="sc-desc" {...register("shortDescription")} placeholder="Shown under the name in the student's list"
                  className={controlClass} />
              </InputCell>
            </InputGroup>
          </div>
          </Expand>
        </Section>

        <Section title="The case" open={isOpen("case")} onToggle={() => toggle("case")}
          actions={hasCase && (
            <Button variant="secondary" size="sm" data-no-toggle onClick={(e) => { e.stopPropagation(); copyText(joinPrompt(v.profile, v.caseText), "Prompt copied"); }}>
              <Copy /> Copy prompt
            </Button>
          )}>
          <Expand open={isOpen("case")} tall>
            <div className="mt-3 flex flex-col gap-0.5">
              <InputGroup>
                <InputCell label="Patient profile" labelClass="text-xl font-semibold text-[rgb(var(--vx-ink))]" className="flex-1" htmlFor="sc-profile"
                  hint={`${wordCount(v.profile)} words`}>
                  <AutoTextarea id="sc-profile" minPx={160} maxVh={400} value={v.profile} onChange={setText("profile")} disabled={aiBusy}
                    className="text-base leading-relaxed" />
                </InputCell>
              </InputGroup>
              <InputGroup>
                <InputCell label="Case" labelClass="text-xl font-semibold text-[rgb(var(--vx-ink))]" className="flex-1" htmlFor="sc-case"
                  hint={`${wordCount(v.caseText)} words`}>
                  <AutoTextarea id="sc-case" minPx={240} maxVh={400} value={v.caseText} onChange={setText("caseText")} disabled={aiBusy}
                    className="text-base leading-relaxed" />
                </InputCell>
              </InputGroup>
            </div>
          </Expand>
        </Section>

        <Section title="Movements" hint={restricted ? `${restricted} restricted. Everything else moves fully.` : undefined} open={isOpen("movements")} onToggle={() => toggle("movements")}>
          <Expand open={isOpen("movements")} tall><MovementPicker control={control} regions={REGIONS} /></Expand>
        </Section>

        <Section title="Learning and feedback"
          open={isOpen("learn")} onToggle={() => toggle("learn")}
          hint={isOpen("learn") ? undefined : `${objectives} objective${objectives === 1 ? "" : "s"} · ${questions} feedback question${questions === 1 ? "" : "s"} for this case`}
>
          <Expand open={isOpen("learn")} tall>
            <div className="flex flex-col gap-0.5">
              <InputGroup>
                <InputCell label="Learning objectives (one per line)" labelClass="text-xl font-semibold text-[rgb(var(--vx-ink))]" className="flex-1" htmlFor="sc-lo">
                  <AutoTextarea id="sc-lo" minPx={96} value={v.learningObjectives} onChange={setText("learningObjectives")}
                    placeholder="e.g. Explore how the pain affects the patient's work" />
                </InputCell>
              </InputGroup>
              <InputGroup>
                <InputCell label="Feedback questions for this case (one per line)" labelClass="text-xl font-semibold text-[rgb(var(--vx-ink))]" className="flex-1" htmlFor="sc-fq">
                  <AutoTextarea id="sc-fq" minPx={96} value={v.questionsForFeedback} onChange={setText("questionsForFeedback")}
                    placeholder="Added to the standard questions for the profession" />
                </InputCell>
              </InputGroup>
              <div className="mt-2">
                <Button variant="secondary" size="sm" onClick={() => setPickRubric(true)}><ListChecks /> Add from rubric bank</Button>
              </div>
              {pickRubric && (
                <RubricPicker onClose={() => setPickRubric(false)}
                  onAdd={(texts) => setValue("questionsForFeedback", [String(v.questionsForFeedback || "").trim(), ...texts].filter(Boolean).join("\n"), { shouldDirty: true })} />
              )}
            </div>
          </Expand>
        </Section>

        </fieldset>
        {isSuperadmin && (
          <p className={cn("text-xs", muted)}>Environment and avatar model use the defaults.</p>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-40 rounded-full border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-bg)/0.95)] p-1.5 shadow-lg backdrop-blur">
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={cancel} disabled={saving || aiBusy}>Cancel</Button>
          {isEdit && scenario?.testable === true && (
            <Button variant="secondary" size="lg" onClick={testIt} disabled={saving || aiBusy || testing} title="Open the saved version in the simulator">
              {testing ? <Loader className="animate-spin" /> : <Play />} Test
            </Button>
          )}
          {(!isEdit || v.status !== "Published" || unlocked) && !locked ? (
            <Button variant="secondary" size="lg" onClick={() => save("Draft")} disabled={!nameOk || saving || aiBusy}>{unlocked ? "Save as draft" : "Save draft"}</Button>
          ) : null}
          {!locked && <Button key={ready ? "ready" : "not"} size="lg" onClick={() => save("Published")} disabled={!ready || saving || aiBusy}
            className={cn(ready && "vx-pop ring-4 ring-[rgb(var(--vx-accent)/0.25)]")}>
            {saving && <Loader className="animate-spin" />} {mainLabel}
          </Button>}
        </ButtonGroup>
      </div>
    </div>
  );
}
