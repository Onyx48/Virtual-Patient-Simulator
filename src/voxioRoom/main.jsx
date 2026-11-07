// Voxio patient room. Opened by an educator's Test button (TEST_ROOM_URL in the backend .env):
//   /room.html?session=<id>&name=<scenario>&patient=<name>
// Always runs on VITE_VOXIO_TEST_FLOW_KEY. With ?session it fetches that scenario's customs from
// the backend; without it, it runs the built-in Mr Chen test scenario (testScenario.js).
//
// The visit follows the Notion learning architecture (v9), in the screens learners know from the 3D build:
//   intro -> name -> History Taking (timer, captions, End Session)
//   -> guided self-reflection (spoken, before any score) -> Feedback Summary
//   -> Clinical Reasoning (spoken; clinical-reasoning-AI-guide v1.6, 10-minute limit)
//   -> Clinical Reasoning feedback (clinical-reasoning-feedback-engine v1.7, scored in code) -> Exit.
//
// VITE_ROOM_MODE=dev  -> also shows what the flow sends back (movement, frame, expression, raw packets)
// VITE_ROOM_MODE=prod -> learner view only. Unset: dev on the Vite dev server, prod in a build.
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSession } from "voxioagent/client";
import { Mic, MicOff, PhoneOff, Play, Send, Activity, ChevronDown, ChevronUp, Captions, ArrowLeft, MessageSquare, X, Brain, LogOut } from "lucide-react";
import "../index.css";
import { SCENARIO, buildCustoms } from "./testScenario.js";

// Must match END_SESSION_INPUT in backend/utils/simEngine.js: the patient node sets
// end_diagnosis "yes" on exactly this line, and the judge node branches to feedback.
const END_SESSION_INPUT = "Let's end the session";
// Markers the flow routes on (simEngine.js, voxioFlow.js). Lines starting with "[" are never
// shown as the learner's words.
const START_OF_REFLECTION = "[START_OF_REFLECTION]";
const END_OF_REFLECTION = "[END_OF_REFLECTION]";
const START_OF_CLINICAL_REASONING = "[START_OF_CLINICAL_REASONING]";
const END_OF_CLINICAL_REASONING = "[END_OF_CLINICAL_REASONING]";
const FEEDBACK_WAIT_MS = 90000; // after this, Exit is offered even if no result came
/*
 * Never send a line while a Voxio turn is still running: Voxio treats it as the learner cutting in,
 * answers from the state before that turn and drops what the turn was writing. So the room waits
 * for the packet each slow step ends with: the feedback (end of the goodbye turn), the reflection
 * result (end of the reflection), the Clinical Reasoning feedback (end of the guide).
 */
const SETTLE_MS = 1000;
const CR_LIMIT_S = 600; // guide doc 1.8: the platform ends Clinical Reasoning at 10 minutes
const CLOSE_MS = 3000; // after the guide's closing line, before the platform ends the session

/*
 * Clinical Reasoning score, calculated in code as feedback engine doc 1.5 and 1.9 require:
 * a criterion's final rating is the lower of its quality rating and the cap set by its
 * independence level (criterion 3: the lower of physical_observation and whole_picture);
 * the percentage is the sum of final rating / 4 x weight. Skipped or distress: no score.
 */
const CR_WEIGHTS = { 1: 0.2, 2: 0.25, 3: 0.25, 4: 0.15, 5: 0.15 };
const CR_NAMES = { 1: "Information Gathering and Cue Recognition", 2: "Hypothesis Generation and Prioritisation", 3: "Analysis and Interpretation of Findings", 4: "Red Flags and Safety Screening", 5: "Justification and Reflection" };
const CR_ELEMENTS = { 1: ["cues"], 2: ["hypotheses"], 3: ["physical_observation", "whole_picture"], 4: ["red_flags"], 5: ["examination"] };
const INDEPENDENCE = ["independent", "prompted", "step_by_step", "not_reached", "not_covered"]; // high to low
const CAP = { independent: 4, prompted: 3, step_by_step: 2, not_reached: 1, not_covered: 1 };
const INDEPENDENCE_LABEL = { independent: "On your own", prompted: "With a prompt", step_by_step: "With step-by-step guidance", not_reached: "Not yet", not_covered: "Not covered this time" };
const LEVEL = { 4: "Highly Proficient", 3: "Proficient", 2: "Developing", 1: "Needs Development" };

function scoreReasoning(fb, status) {
  if (!fb || status === "skipped" || status === "ended_early_distress" || !Array.isArray(fb.criteria) || !fb.criteria.length) return { percent: null, rows: [] };
  const elements = fb.element_independence || {};
  const rows = [1, 2, 3, 4, 5].map((n) => {
    const c = fb.criteria.find((x) => Number(x.criterion) === n) || {};
    const levels = CR_ELEMENTS[n].map((k) => elements[k]).filter((v) => INDEPENDENCE.includes(v));
    const independence = levels.length
      ? levels.reduce((low, v) => (INDEPENDENCE.indexOf(v) > INDEPENDENCE.indexOf(low) ? v : low))
      : INDEPENDENCE.includes(c.independence) ? c.independence : "not_covered";
    const quality = Math.max(1, Math.min(4, Math.round(Number(c.quality_rating) || 1)));
    return { n, name: CR_NAMES[n], independence, final: Math.min(quality, CAP[independence]) };
  });
  return { percent: Math.round(rows.reduce((sum, r) => sum + (r.final / 4) * CR_WEIGHTS[r.n], 0) * 100), rows };
}

const params = new URLSearchParams(location.search);
const SESSION_ID = params.get("session");
const FLOW_KEY = import.meta.env.VITE_VOXIO_TEST_FLOW_KEY;
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"; // same variable as src/main.jsx

async function loadCustoms() {
  if (!SESSION_ID) return buildCustoms();
  // The room is its own page, so it gets its access token from the refresh cookie itself.
  const auth = await fetch(`${API}/api/auth/refresh`, { method: "POST", credentials: "include" });
  if (!auth.ok) {
    window.location.href = "/login";
    throw new Error("Your login has expired. Taking you to the login page…");
  }
  const { token } = await auth.json();
  const r = await fetch(`${API}/api/scenarios/room/${SESSION_ID}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || `Could not load the scenario (${r.status})`);
  return body.customs;
}

// The learner's first name: the patient may use it, and the clinical-reasoning guide and feedback
// engine get it as learner_name (guide doc 1.6). The reflection guide never uses it (agreed with the client).
function withLearnerName(customs, name) {
  const clean = name.replace(/["\\]/g, "").trim();
  if (!clean) return customs;
  const vars = customs?.variables;
  if (vars?.learner_name) vars.learner_name = { ...vars.learner_name, default: clean };
  const p = customs?.agent_id?.workflow?.nodes?.patient?.parameters;
  if (p?.system_prompt) p.system_prompt += `\n\n# THE LEARNER\nThe learner's name is "${clean}". Call them by this name when it is natural, as you would in clinic.`;
  return customs;
}

const TITLE = params.get("name") || (SESSION_ID ? "Scenario test" : SCENARIO.name);
const PATIENT = params.get("patient") || (SESSION_ID ? "Patient" : SCENARIO.name);
const MODE = (import.meta.env.VITE_ROOM_MODE || (import.meta.env.DEV ? "dev" : "prod")).toLowerCase();
const DEV = MODE === "dev";

const asText = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const time = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "P";
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const percentOf = (score) => (score == null ? null : Math.round(score <= 1 ? score * 100 : score));
const asJson = (v) => { if (v && typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } };
// The guide's hidden tag never reaches the learner (guide doc 1.8), even if it slips into speech.
const noTag = (t) => asText(t).replace(/\[NARROW\]\s*/g, "");

class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <pre className="p-6 text-red-700 whitespace-pre-wrap">Room crashed:{"\n"}{String(this.state.err?.stack || this.state.err)}</pre>;
  }
}

const STATE = {
  idle: { label: "Ready", dot: "bg-neutral-400" },
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse" },
  listening: { label: "Listening", dot: "bg-emerald-400 animate-pulse" },
  speaking: { label: "Speaking", dot: "bg-emerald-400 animate-pulse" },
  ended: { label: "Ended", dot: "bg-neutral-500" },
  error: { label: "Error", dot: "bg-red-500" },
};

// who is speaking to the learner in each part of the visit
const SPEAKER = { reflection: "Reflection guide", reasoning: "Clinical Reasoning guide" };
const STAGE_TITLE = { reflection: "Self-reflection", reasoning: "Clinical Reasoning" };

function ScoreRing({ value }) {
  const r = 52, c = 2 * Math.PI * r, frac = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="text-white transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span className="text-3xl font-semibold">{value == null ? "–" : `${value}%`}</span>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, actions }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          {onClose && <button onClick={onClose} className="text-neutral-400 hover:text-white" title="Close"><X className="w-5 h-5" /></button>}
        </div>
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}

const PrimaryBtn = ({ children, ...p }) => <button {...p} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-neutral-900 font-medium disabled:opacity-40">{children}</button>;
const SecondaryBtn = ({ children, ...p }) => <button {...p} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 hover:bg-white/10">{children}</button>;

function Room() {
  const [step, setStep] = useState("intro"); // intro -> name -> live
  const [learner, setLearner] = useState("");
  const [state, setState] = useState("idle");
  const [turns, setTurns] = useState([]); // {who: 'patient'|'you', text, final, stage}
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [hasVideo, setHasVideo] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [live, setLive] = useState({ frame: "main", movement: [], expression: "" });
  const [events, setEvents] = useState([]); // dev: every agent packet
  const [devOpen, setDevOpen] = useState(true);
  const [feedback, setFeedback] = useState(null); // history-taking feedback, held until reflection ends
  const [crResult, setCrResult] = useState(null); // {fb, status}
  const [showCase, setShowCase] = useState(false);
  const [modal, setModal] = useState(null); // null | "feedback" | "cr"
  const [seconds, setSeconds] = useState(0);
  const [crSeconds, setCrSeconds] = useState(0);
  /*
   * consult -> ending (patient says goodbye) -> reflection -> feedback (summary)
   * -> reasoning (guide) -> cr_ending (engine scoring) -> cr_feedback
   */
  const [phase, setPhaseState] = useState("consult");
  const phaseRef = useRef("consult"); // the session's handlers are bound once, so they read a ref
  const setPhase = (next) => {
    const v = typeof next === "function" ? next(phaseRef.current) : next;
    phaseRef.current = v;
    setPhaseState(v);
  };
  const stage = () => (["reflection", "reasoning"].includes(phaseRef.current) ? phaseRef.current : "consult");
  const [waitedLong, setWaitedLong] = useState(false);
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const session = useRef(null);
  const turnsRef = useRef([]);
  const audio = useRef(null);
  const video = useRef(null);
  const bottom = useRef(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  // block body on purpose: newer Chrome returns a Promise from scrollIntoView
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, chatOpen]);
  useEffect(() => () => session.current?.destroy(), []);
  useEffect(() => { document.title = `${PATIENT} · Patient room`; }, []);
  useEffect(() => {
    setWaitedLong(false);
    if (!["ending", "cr_ending"].includes(phase)) return undefined;
    const t = setTimeout(() => setWaitedLong(true), FEEDBACK_WAIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const active = ["connecting", "listening", "speaking"].includes(state);
  useEffect(() => {
    if (!active || !["consult", "reasoning"].includes(phase)) return undefined;
    const t = setInterval(() => (phase === "consult" ? setSeconds : setCrSeconds)((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active, phase]);

  const send = (msg) => Boolean(session.current?.sendText(msg));

  // The guided self-reflection comes before any score (learning architecture v9).
  const startReflection = () => {
    const said = turnsRef.current
      .filter((t) => t.stage === "consult" && t.final && t.text && t.text !== END_SESSION_INPUT)
      .map((t, i) => `${i + 1}. ${t.who === "you" ? "Learner" : "Patient"}: ${t.text}`).join("\n");
    if (send(`${START_OF_REFLECTION}\n\nSession transcript:\n${said || "(The learner did not speak.)"}`)) setPhase("reflection");
  };
  const finishReflection = () => {
    if (!send(END_OF_REFLECTION)) return;
    setPhase("feedback");
    setModal("feedback");
  };
  const startReasoning = () => {
    if (!send(START_OF_CLINICAL_REASONING)) return;
    setModal(null);
    setCrSeconds(0);
    setPhase("reasoning");
    if (session.current.muted) { session.current.mute(false); setMuted(false); }
  };
  const endReasoning = () => {
    if (phaseRef.current !== "reasoning") return;
    if (!send(END_OF_CLINICAL_REASONING)) return;
    setPhase("cr_ending");
  };
  useEffect(() => { if (phase === "reasoning" && crSeconds >= CR_LIMIT_S) endReasoning(); }, [crSeconds, phase]);

  const onReply = (r) =>
    setTurns((t) => {
      const turn = { who: "patient", text: noTag(r?.text), final: !!r?.final, stage: stage() };
      const last = t[t.length - 1];
      return last?.who === "patient" && !last.final ? [...t.slice(0, -1), turn] : [...t, turn];
    });

  const onAgent = (p) => {
    const d = p?.out && typeof p.out === "object" ? p.out : p;
    if (DEV) setEvents((e) => [{ at: time(), data: d }, ...e].slice(0, 200));
    if (typeof d?.frame === "string" || Array.isArray(d?.movement) || typeof d?.expression === "string")
      setLive((l) => ({
        frame: typeof d.frame === "string" ? d.frame : l.frame,
        movement: Array.isArray(d.movement) ? d.movement : l.movement,
        expression: typeof d.expression === "string" ? d.expression : l.expression,
      }));
    // Spoken "let's end the session" (or a goodbye) ends the visit the same way as End Session.
    if (String(d?.end_diagnosis || "").toLowerCase() === "yes" && phaseRef.current === "consult") setPhase("ending");
    const said = d?.user_input;
    if (typeof said === "string" && said.trim() && !said.startsWith("["))
      setTurns((t) => (t.some((x) => x.who === "you" && x.text === said && x.local) ? t : [...t, { who: "you", text: said, final: true, stage: stage() }]));
    if (typeof d?.feedback === "string" || typeof d?.score === "number") {
      setFeedback({ text: asText(d.feedback), score: typeof d.score === "number" ? d.score : null });
      // the goodbye turn has finished: now the reflection guide can start
      setTimeout(() => { if (phaseRef.current === "ending") startReflection(); }, SETTLE_MS);
    }
    if (String(d?.reflection_done || "").toLowerCase() === "yes") setReflectionSaved(true);
    // The guide spoke its close (normal, skip or distress): the platform ends the session.
    if (String(d?.cr_done || "").toLowerCase() === "yes") setTimeout(endReasoning, CLOSE_MS);
    if (d?.cr_feedback) {
      setCrResult({ fb: asJson(d.cr_feedback), status: d.cr_status || asJson(d.cr_feedback)?.status });
      setPhase("cr_feedback");
      setModal("cr");
    }
  };

  const start = async () => {
    setError(""); setTurns([]); setEvents([]); setFeedback(null); setReflectionSaved(false); setCrResult(null); setModal(null); setHasVideo(false);
    setPhase("consult"); setSeconds(0); setCrSeconds(0); setStep("live");
    let customs;
    try { customs = withLearnerName(await loadCustoms(), learner); } catch (e) { setError(e.message); return; }
    const s = createSession({ flowKey: FLOW_KEY, environment: "gpu", media: { audio: true, video: true }, customs, resume: false });
    session.current = s;
    s.on("state", (st) => setState(asText(st)));
    s.on("reply", onReply);
    s.on("agent", onAgent);
    s.on("agentVideo", (stream) => { setHasVideo(true); if (video.current) video.current.srcObject = stream; });
    s.on("agentAudio", (stream) => { if (audio.current) audio.current.srcObject = stream; });
    s.on("error", (e) => setError(asText(`${e?.code || ""} ${e?.message || e}`.trim())));
    s.on("ended", () => setState("ended"));
    try { await s.start(); } catch (e) { setError(asText(e?.message || e)); setState("error"); }
  };

  const exit = () => { session.current?.destroy(); history.length > 1 ? history.back() : (window.location.href = "/"); };
  /*
   * End Session does not hang up: it types the end-of-session line into the agent loop over the
   * data channel (sendText, no transcription), exactly as if the learner had said it, so the flow
   * goes patient -> judge -> feedback. The call stays open for the reflection and Clinical Reasoning.
   */
  const endVisit = () => {
    if (!send(END_SESSION_INPUT)) return session.current?.stop();
    setPhase("ending");
  };
  const toggleMute = () => { const s = session.current; if (!s) return; s.mute(!s.muted); setMuted(!s.muted); };
  const typed = (e) => {
    e.preventDefault();
    const msg = text.trim();
    setText("");
    if (!msg || !send(msg)) return;
    setTurns((t) => [...t, { who: "you", text: msg, final: true, local: true, stage: stage() }]);
  };

  const talking = ["reflection", "reasoning"].includes(phase) ? phase : "consult";
  const speaker = SPEAKER[talking] || PATIENT;
  const st = STATE[state] || { label: state, dot: "bg-neutral-400" };
  const lastSpoken = [...turns].reverse().find((t) => t.who === "patient" && t.stage === talking);
  const moving = live.frame && live.frame !== "main";
  const cr = crResult && scoreReasoning(crResult.fb, crResult.status);
  const fb = crResult?.fb || {};
  const waiting = (label) => (
    <span className="flex items-center gap-2 h-12 px-5 rounded-full bg-white/10 border border-white/15 text-sm text-neutral-200">
      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {label}
    </span>
  );
  const exitBtn = (
    <button onClick={exit} className="flex items-center gap-2 h-12 px-5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium"><LogOut className="w-4 h-4" /> Exit</button>
  );

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden">
      <header className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/10 bg-neutral-950">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={exit} className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white" title="Back to scenarios">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold leading-tight truncate">{STAGE_TITLE[talking] || PATIENT}</h1>
            <p className="text-xs text-neutral-400 truncate">{TITLE}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {DEV && <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Dev mode</span>}
          {step === "live" && (
            <span className="font-mono text-sm tabular-nums px-3 py-1.5 rounded-full bg-white/5 border border-white/10" title={phase === "reasoning" ? "Clinical Reasoning time left" : "Session time"}>
              {phase === "reasoning" ? clock(Math.max(0, CR_LIMIT_S - crSeconds)) : clock(seconds)}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}
          </span>
          {step === "live" && (
            <button onClick={() => setChatOpen((o) => !o)} title="Transcript" className={`h-9 w-9 grid place-items-center rounded-full border ${chatOpen ? "bg-white/15 border-white/25" : "bg-white/5 border-white/10 text-neutral-300"}`}>
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full flex flex-col lg:flex-row">
        <section className="relative flex-1 min-w-0 min-h-[55vh] lg:min-h-0 bg-black flex flex-col">
          <div className="relative flex-1 grid place-items-center">
            <video ref={video} autoPlay playsInline className={`absolute inset-0 w-full h-full object-contain ${hasVideo ? "" : "hidden"}`} />

            {step === "intro" && (
              <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center">
                <p className="text-xs uppercase tracking-wider text-neutral-500">History taking</p>
                <h2 className="mt-2 text-xl font-semibold">{TITLE}</h2>
                <p className="mt-3 text-sm text-neutral-400">You are about to meet {PATIENT}. Take a history as you would in clinic. Speak naturally; when you are done, press End Session or say “let’s end the session”. A short self-reflection, your feedback and a Clinical Reasoning conversation follow.</p>
                <button onClick={() => setStep("name")} className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-neutral-900 font-medium">
                  <Play className="w-4 h-4" /> Start
                </button>
              </div>
            )}

            {step === "name" && (
              <form onSubmit={(e) => { e.preventDefault(); start(); }} className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center">
                <h2 className="text-lg font-semibold">What should the patient call you?</h2>
                <input autoFocus value={learner} onChange={(e) => setLearner(e.target.value)} maxLength={40} placeholder="Your first name"
                  className="mt-4 w-full rounded-xl bg-neutral-800 border border-white/10 px-3 py-2.5 text-center text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/40" />
                <button disabled={!FLOW_KEY || !learner.trim()} className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-neutral-900 font-medium disabled:opacity-40">
                  <Play className="w-4 h-4" /> Begin session
                </button>
              </form>
            )}

            {step === "live" && !hasVideo && (
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className={`h-28 w-28 rounded-full bg-neutral-800 grid place-items-center text-3xl font-semibold text-neutral-300 ${state === "connecting" ? "animate-pulse" : ""}`}>{initials(PATIENT)}</div>
                <p className="text-neutral-400 text-sm max-w-xs">{state === "ended" ? "The session has ended." : active ? "" : "Connecting to the patient…"}</p>
              </div>
            )}

            {DEV && hasVideo && (
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <span className={`text-xs font-mono px-2 py-1 rounded-md border ${moving ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200" : "bg-black/50 border-white/10 text-neutral-300"}`}>frame: {live.frame}</span>
                {live.expression && <span className="text-xs font-mono px-2 py-1 rounded-md bg-black/50 border border-white/10 text-neutral-300">expression: {live.expression}</span>}
              </div>
            )}

            {SPEAKER[talking] && active && (
              <div className="absolute top-3 right-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-black/60 border border-white/15">
                <Brain className="w-3.5 h-3.5" /> Talking with the {SPEAKER[talking]}
              </div>
            )}

            {captions && step === "live" && lastSpoken?.text && state !== "ended" && !modal && (
              <div className="absolute bottom-24 inset-x-0 flex justify-center px-6 pointer-events-none">
                <p className="max-w-2xl text-center text-base sm:text-lg leading-snug bg-black/60 backdrop-blur px-4 py-2 rounded-xl">
                  {SPEAKER[talking] && <span className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-0.5">{SPEAKER[talking]}</span>}
                  {lastSpoken.text}
                </p>
              </div>
            )}

            {/* History Taking: Feedback Summary, released only after the self-reflection */}
            {modal === "feedback" && (
              <Modal title="Feedback Summary" onClose={feedback ? () => setModal(null) : null}
                actions={<>
                  <PrimaryBtn onClick={startReasoning} disabled={!active || !feedback || !reflectionSaved || phase !== "feedback"}>
                    {reflectionSaved ? <Brain className="w-4 h-4" /> : <span className="h-4 w-4 rounded-full border-2 border-neutral-400 border-t-neutral-900 animate-spin" />} Clinical Reasoning
                  </PrimaryBtn>
                  <SecondaryBtn onClick={exit}><LogOut className="w-4 h-4" /> Exit</SecondaryBtn>
                </>}>
                {!feedback ? (
                  <div className="mt-8 mb-4 flex flex-col items-center gap-3 text-sm text-neutral-400">
                    <span className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Preparing your feedback…
                  </div>
                ) : (
                  <div className="mt-5 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <ScoreRing value={percentOf(feedback.score)} />
                    <div className="text-sm text-neutral-300 space-y-3 leading-relaxed">
                      {feedback.text.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                      <p className="text-xs text-neutral-500">This feedback is AI-generated.</p>
                    </div>
                  </div>
                )}
              </Modal>
            )}

            {/* Clinical Reasoning feedback, as in feedback engine doc 1.8 */}
            {modal === "cr" && crResult && (
              <Modal title="Clinical Reasoning Feedback" onClose={() => setModal(null)} actions={<SecondaryBtn onClick={exit}><LogOut className="w-4 h-4" /> Exit</SecondaryBtn>}>
                {!crResult.fb ? (
                  <p className="mt-4 text-sm text-neutral-400">The feedback could not be read. Please try the session again.</p>
                ) : (
                  <div className="mt-5 space-y-5 text-sm">
                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                      {cr.percent != null && <ScoreRing value={cr.percent} />}
                      <div className="space-y-4 leading-relaxed text-neutral-300">
                        {fb.summary && <p>{fb.summary}</p>}
                        {fb.went_well?.length > 0 && (
                          <div><h3 className="font-semibold text-white mb-1">What went well</h3>
                            <ul className="list-disc pl-5 space-y-1">{fb.went_well.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                        )}
                        {fb.work_on?.length > 0 && (
                          <div><h3 className="font-semibold text-white mb-1">What to work on</h3>
                            <ul className="list-disc pl-5 space-y-1">{fb.work_on.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                        )}
                        {fb.focus_next_time && <div><h3 className="font-semibold text-white mb-1">Focus for next time</h3><p>{fb.focus_next_time}</p></div>}
                      </div>
                    </div>
                    {cr.rows.length > 0 && (
                      <div className="rounded-xl border border-white/10 divide-y divide-white/10">
                        {cr.rows.map((r) => (
                          <div key={r.n} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-neutral-200">{r.n}. {r.name}</span>
                            <span className="text-xs text-neutral-400">{r.final}/4 · {LEVEL[r.final]} · {INDEPENDENCE_LABEL[r.independence]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {fb.case_reveal && (
                      <div>
                        <button onClick={() => setShowCase((v) => !v)} className="rounded-full border border-white/15 px-4 py-1.5 text-xs hover:bg-white/10">{showCase ? "Hide the case" : "Show the case"}</button>
                        {showCase && (
                          <dl className="mt-3 space-y-2 text-neutral-300">
                            {[["diagnosis", "Diagnosis"], ["alternatives", "Alternatives"], ["key_findings", "Key findings"], ["red_flags", "Red flags"], ["examination", "Examination"], ["not_uncovered", "Not uncovered"], ["expert_reasoning", "Expert reasoning"]]
                              .filter(([k]) => fb.case_reveal[k]).map(([k, label]) => (
                                <div key={k}><dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt><dd>{fb.case_reveal[k]}</dd></div>
                              ))}
                          </dl>
                        )}
                      </div>
                    )}
                    {DEV && <p className="text-xs font-mono text-amber-300">educator only · missed_red_flag: {String(fb.missed_red_flag)} · distress_flag: {String(fb.distress_flag)} · status: {crResult.status || "-"}</p>}
                    <p className="text-xs text-neutral-500">This feedback is AI-generated.</p>
                  </div>
                )}
              </Modal>
            )}
          </div>

          {step === "live" && (
            <div className="absolute bottom-0 inset-x-0 z-10 p-5 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent">
              {!active ? (
                <button onClick={start} disabled={!FLOW_KEY || state === "connecting"} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-neutral-900 font-medium disabled:opacity-40">
                  <Play className="w-4 h-4" /> {state === "ended" || state === "error" ? "Start again" : "Connecting…"}
                </button>
              ) : (
                <>
                  <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} className={`h-12 w-12 grid place-items-center rounded-full border ${muted ? "bg-red-500/20 border-red-400/40 text-red-200" : "bg-white/10 border-white/15 hover:bg-white/15"}`}>
                    {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setCaptions((c) => !c)} title="Captions" className={`h-12 w-12 grid place-items-center rounded-full border ${captions ? "bg-white/15 border-white/25" : "bg-white/5 border-white/10 text-neutral-400"}`}>
                    <Captions className="w-5 h-5" />
                  </button>
                  {phase === "consult" && (
                    <button onClick={endVisit} className="flex items-center gap-2 h-12 px-5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium"><PhoneOff className="w-4 h-4" /> End Session</button>
                  )}
                  {phase === "ending" && !waitedLong && waiting("Preparing your self-reflection…")}
                  {phase === "reflection" && (
                    <button onClick={finishReflection} className="h-12 px-5 rounded-full bg-white text-neutral-900 font-medium">Finish reflection</button>
                  )}
                  {phase === "feedback" && !modal && <button onClick={() => setModal("feedback")} className="h-12 px-5 rounded-full bg-white text-neutral-900 font-medium">Feedback Summary</button>}
                  {phase === "reasoning" && (
                    <button onClick={endReasoning} className="h-12 px-5 rounded-full bg-white text-neutral-900 font-medium">Finish Clinical Reasoning</button>
                  )}
                  {phase === "cr_ending" && (waitedLong ? exitBtn : waiting("Preparing your Clinical Reasoning feedback…"))}
                  {phase === "cr_feedback" && !modal && <button onClick={() => setModal("cr")} className="h-12 px-5 rounded-full bg-white text-neutral-900 font-medium">Clinical Reasoning Feedback</button>}
                  {(phase === "cr_feedback" || (phase === "ending" && waitedLong)) && exitBtn}
                </>
              )}
            </div>
          )}
          {!FLOW_KEY && <p className="text-center text-xs text-red-300 pb-3">VITE_VOXIO_TEST_FLOW_KEY is missing in .env.</p>}
          {error && <p className="absolute bottom-20 inset-x-0 z-10 text-center text-xs text-red-300 px-4">{error}</p>}
          <audio ref={audio} autoPlay />
        </section>

        {(chatOpen || DEV) && step === "live" && (
          <aside className="w-full lg:w-[380px] xl:w-[420px] shrink-0 min-h-0 flex flex-col border-l border-white/10 bg-neutral-900">
            {chatOpen && (
              <div className="flex-1 min-h-[20rem] lg:min-h-0 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold flex items-center justify-between">
                  <span>Transcript</span>
                  <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {turns.length === 0 && <p className="text-sm text-neutral-500 text-center mt-8">What you and {PATIENT} say appears here.</p>}
                  {turns.map((t, i) => (
                    <div key={i}>
                      {t.stage !== "consult" && turns[i - 1]?.stage !== t.stage && (
                        <div className="flex items-center gap-3 py-2 text-[11px] uppercase tracking-wider text-neutral-500">
                          <span className="h-px flex-1 bg-white/10" /> {STAGE_TITLE[t.stage]} <span className="h-px flex-1 bg-white/10" />
                        </div>
                      )}
                      <div className={`flex ${t.who === "you" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] ${t.who === "you" ? "items-end" : "items-start"} flex flex-col`}>
                          <span className="text-[11px] text-neutral-500 mb-1 px-1">{t.who === "you" ? "You" : SPEAKER[t.stage] || PATIENT}</span>
                          <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${t.who === "you" ? "bg-white text-neutral-900 rounded-br-md" : "bg-neutral-800 text-neutral-100 rounded-bl-md"} ${t.final ? "" : "opacity-70"}`}>
                            {t.text || <span className="inline-flex gap-1"><span className="animate-bounce">·</span><span className="animate-bounce [animation-delay:120ms]">·</span><span className="animate-bounce [animation-delay:240ms]">·</span></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottom} />
                </div>
                {/* typing stays as a fallback when the mic is not an option */}
                <form onSubmit={typed} className="border-t border-white/10 p-3 flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} disabled={!active} placeholder={!active ? "Not connected" : `Type to the ${speaker}…`} className="flex-1 rounded-xl bg-neutral-800 border border-white/10 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/40 disabled:opacity-50" />
                  <button disabled={!active || !text.trim()} className="h-10 w-10 grid place-items-center rounded-xl bg-white text-neutral-900 disabled:opacity-30"><Send className="w-4 h-4" /></button>
                </form>
              </div>
            )}

            {DEV && (
              <div className={`shrink-0 border-t border-amber-500/30 bg-neutral-950 ${chatOpen ? "" : "flex-1"}`}>
                <button onClick={() => setDevOpen((o) => !o)} className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-amber-200">
                  <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Received from the flow ({events.length})</span>
                  {devOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                {devOpen && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2 mb-3 text-xs font-mono">
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10">movement: {live.movement.length ? live.movement.join(", ") : "[]"}</span>
                      <span className={`px-2 py-1 rounded border ${moving ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : "bg-white/5 border-white/10"}`}>frame: {live.frame}</span>
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10">expression: {live.expression || "-"}</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1.5">
                      {events.length === 0 && <p className="text-xs text-neutral-500">Packets appear here as the flow sends them.</p>}
                      {events.map((e, i) => (
                        <div key={i} className="text-[11px] font-mono leading-snug bg-black/30 rounded px-2 py-1.5 break-all">
                          <span className="text-neutral-500">{e.at} </span><span className="text-neutral-200">{asText(e.data)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Boundary><Room /></Boundary>);
