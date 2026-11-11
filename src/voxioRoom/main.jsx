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
import { ChevronRight, Clock, Mic, MicOff, PhoneOff, Play, Send, Captions, ArrowLeft, MessageSquare, X, Brain, LogOut } from "lucide-react";
import "../index.css";
import { SCENARIO, buildCustoms } from "./testScenario.js";
import { reasoningRecord } from "../../backend/utils/reasoningScore.js";
import Results from "./Results.jsx";
import { ROOM_MOTION, Journey, StageBanner, IntroCard, Presence } from "./RoomParts.jsx";
import FlowPanel from "./FlowPanel.jsx";
import { Button, ButtonGroup } from "../components/vx/ui.jsx";
import "./room.css";
import { htFields, htKeys } from "../lib/htRubric.js";
const HT_KEYS = htKeys(true);
const PdfViewer = React.lazy(() => import("../components/shared/PdfViewer.jsx"));
// A student's run reports its results to the server (POST /api/sessions/:id/room-results):
// the room's Voxio sessions do not reach our webhook. Educator Test runs have no record; the
// server answers 404 and nothing is saved.
const saveResults = async (body) => {
  if (!SESSION_ID) return;
  try {
    const auth = await getAuth();
    const r = await fetch(`${API}/api/sessions/${encodeURIComponent(SESSION_ID)}/room-results`, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.token || ""}` },
      body: JSON.stringify(body),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; /* the next milestone sends everything again */ }
};
// One scored turn, stored as soon as it arrives (POST /api/sessions/:id/ht-turn).
const saveHtTurn = async (turn) => {
  if (!SESSION_ID) return;
  try {
    const auth = await getAuth();
    await fetch(`${API}/api/sessions/${encodeURIComponent(SESSION_ID)}/ht-turn`, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.token || ""}` },
      body: JSON.stringify(turn),
    });
  } catch { /* the end-of-visit report sends every turn again */ }
};
/** The learner's note and flag on this attempt (PATCH /api/sessions/:id/mine). */
const saveMine = async (recordId, body) => {
  try {
    const auth = await getAuth();
    const r = await fetch(`${API}/api/sessions/${recordId}/mine`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.token || ""}` }, body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
};

const fetchReport = async (url) => {
  const auth = await getAuth();
  const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${auth?.token || ""}` } });
  if (!r.ok) throw Object.assign(new Error("report"), { response: { status: r.status } });
  return { data: await r.arrayBuffer() };
};

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

// Clinical Reasoning is scored by the same code the server uses (backend/utils/reasoningScore.js).
const params = new URLSearchParams(location.search);
const SESSION_ID = params.get("session");
const SCENARIO_ID = params.get("scenario");
const FLOW_KEY = import.meta.env.VITE_VOXIO_TEST_FLOW_KEY;
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"; // same variable as src/main.jsx

// The room is its own page, so it gets its access token (and who is signed in) from the refresh cookie.
let authPromise;
const getAuth = () => (authPromise ||= fetch(`${API}/api/auth/refresh`, { method: "POST", credentials: "include" })
  .then(async (r) => (r.ok ? r.json() : null)).catch(() => null));
const firstName = (name) => String(name || "").trim().split(/\s+/).find((w) => w && !/^(dr|prof|mr|mrs|ms|miss|mx)\.?$/i.test(w)) || "";

async function loadCustoms() {
  if (!SESSION_ID) return buildCustoms();
  const auth = await getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    throw new Error("Your login has expired. Taking you to the login page…");
  }
  const { token } = auth;
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

function Room() {
  const [step, setStep] = useState("intro"); // intro -> name -> live
  const [learner, setLearner] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const results = useRef({}); // what the flow sent back, sent to the server at each milestone
  const [insight, setInsight] = useState(null); // the server's answer: skills, previous score, record id
  const report = (patch) => {
    Object.assign(results.current, patch);
    // A learner turn with no score packet was cut short (Voxio dropped it): stored as failed, never as zero.
    const learnerTurns = turnsRef.current.filter((t) => t.who === "you" && t.stage === "consult" && t.text !== END_SESSION_INPUT).length;
    if (results.current.htTurns?.length) {
      const have = new Set(results.current.htTurns.map((t) => t.turn));
      const filled = [...results.current.htTurns];
      for (let n = 1; n <= learnerTurns; n++) if (!have.has(n)) filled.push({ turn: n, at: null, status: "failed", scores: null });
      results.current.htTurns = filled.sort((a, b) => a.turn - b.turn);
      setHtTurns(results.current.htTurns);
    }
    const transcript = turnsRef.current.filter((t) => t.stage === "consult" && t.final && t.text && t.text !== END_SESSION_INPUT).map((t) => ({ who: t.who, text: t.text }));
    saveResults({ ...results.current, transcript, voxioSessionId: session.current?.sessionId }).then((r) => { if (r?.recordId) setInsight(r); });
  };
  // The learner's name comes from their account; the name step is only a fallback.
  useEffect(() => { getAuth().then((a) => { const n = firstName(a?.name); if (n) setLearner((cur) => cur || n); }); }, []);
  const [state, setState] = useState("idle");
  const [turns, setTurns] = useState([]); // {who: 'patient'|'you', text, final, stage}
  const [htTurns, setHtTurns] = useState([]); // per-turn timeline scores
  const startedAt = useRef(Date.now());
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
  const [modal, setModal] = useState(null); // null | "results"
  const [tab, setTab] = useState("reflection"); // results tab: reflection | history | reasoning
  const [reflection, setReflection] = useState(null); // {summary, self_rating} from the reflection guide
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
    setTab("reflection");
    setModal("results");
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
    // The silent history-taking scorer (docs/HT_TIMELINE_PLAN.md): one packet per patient reply.
    if (d?.ht_turn !== undefined && phaseRef.current === "consult") {
      const mine = turnsRef.current.filter((t) => t.who === "you" && t.stage === "consult");
      const turn = mine.length;
      const lastSaid = mine[turn - 1]?.text || "";
      // The closing "end session" line is bookkeeping, not a turn (ci skips it too).
      if (!turn || lastSaid === END_SESSION_INPUT) return;
      const lastSpeak = [...turnsRef.current].reverse().find((t) => t.who === "patient" && t.stage === "consult")?.text || "";
      const scores = {};
      for (const k of HT_KEYS) {
        const f = htFields(k);
        if (!(f.type in d) && !(f.score in d)) continue;
        const type_ = String(d[f.type] ?? "").trim();
        scores[k] = { type_: type_ === "None" ? "" : type_, score: Number(d[f.score]) || 0, description: String(d[f.note] ?? "").replace(/^None$/, "") };
      }
      const entry = { turn, at: Math.round((Date.now() - startedAt.current) / 1000), status: "scored", scores, transcript: lastSaid, speak: lastSpeak };
      results.current.htTurns = [...(results.current.htTurns || []).filter((t) => t.turn !== turn), entry];
      setHtTurns(results.current.htTurns);
      saveHtTurn(entry); // stored now, per turn, like ci's webhook
    }
    if (typeof d?.feedback === "string" || typeof d?.score === "number") {
      setFeedback({ text: asText(d.feedback), score: typeof d.score === "number" ? d.score : null });
      report({ feedback: asText(d.feedback), score: d.score, questions: d.questions });
      // the goodbye turn has finished: now the reflection guide can start
      setTimeout(() => { if (phaseRef.current === "ending") startReflection(); }, SETTLE_MS);
    }
    if (String(d?.reflection_done || "").toLowerCase() === "yes") {
      setReflectionSaved(true);
      const rating = Number(d.self_rating);
      const summary = typeof d.summary === "string" && !["", "None", "null"].includes(d.summary.trim()) ? d.summary.trim() : null;
      setReflection({ summary, self_rating: Number.isFinite(rating) && rating >= 1 && rating <= 10 ? Math.round(rating) : null });
      report({ reflection: { summary: d.summary, self_rating: d.self_rating, status: d.status, distress_flag: d.distress_flag } });
    }
    // The guide spoke its close (normal, skip or distress): the platform ends the session.
    if (String(d?.cr_done || "").toLowerCase() === "yes") setTimeout(endReasoning, CLOSE_MS);
    if (d?.cr_feedback) {
      setCrResult({ fb: asJson(d.cr_feedback), status: d.cr_status || asJson(d.cr_feedback)?.status });
      report({ cr: { feedback: d.cr_feedback, status: d.cr_status || asJson(d.cr_feedback)?.status } });
      setPhase("cr_feedback");
      setTab("reasoning");
      setModal("results");
    }
  };

  const start = async () => {
    results.current = {}; setHtTurns([]); startedAt.current = Date.now(); setError(""); setTurns([]); setEvents([]); setFeedback(null); setReflectionSaved(false); setReflection(null); setCrResult(null); setModal(null); setTab("reflection"); setHasVideo(false);
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

  const exit = () => { if (Object.keys(results.current).length) report({}); session.current?.destroy();
    // A student's run: straight to this scenario's page, on the attempt just done.
    if (SCENARIO_ID) window.location.href = `/student/scenario/${encodeURIComponent(SCENARIO_ID)}${insight?.recordId ? `?attempt=${insight.recordId}` : ""}`;
    else history.length > 1 ? history.back() : (window.location.href = "/");
  };
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
  const lastSpoken = [...turns].reverse().find((t) => t.who === "patient" && t.stage === talking);
  const moving = live.frame && live.frame !== "main";
  const cr = crResult ? reasoningRecord(crResult.fb, crResult.status) : null;
  const waiting = (label) => (
    <span className="flex h-12 items-center gap-3 rounded-[24px] bg-[rgb(var(--vx-cell))] px-6 text-base">
      <span className="size-5 rounded-full border-2 border-white/25 border-t-[rgb(var(--vx-accent))] animate-spin" /> <span className="vx-ai-text">{label}</span>
    </span>
  );
  const exitBtn = <Button size="lg" onClick={exit} className="bg-[rgb(var(--vx-danger))] px-7 text-white"><LogOut /> Exit</Button>;
  const nextBtn = (label, onClick) => <Button size="lg" onClick={onClick} className="px-7">{label}</Button>;
  const crLeft = CR_LIMIT_S - crSeconds;
  const clockTone = phase === "reasoning" && crLeft <= 60 ? "text-[rgb(var(--vx-danger))] animate-pulse" : phase === "reasoning" && crLeft <= 180 ? "text-[rgb(var(--vx-warn))]" : "";

  return (
    <div className="vx vx-room h-screen flex flex-col overflow-hidden">
      <style>{ROOM_MOTION}</style>
      <header className="shrink-0 flex items-center justify-between gap-4 border-b border-[rgb(var(--vx-line))] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight">{SPEAKER[talking] || PATIENT}</h1>
            <p className="truncate text-sm text-[rgb(var(--vx-muted))]">{TITLE}</p>
          </div>
        </div>
        {(
          <ButtonGroup className="shrink-0">
            {DEV && <span className="flex h-12 items-center rounded-[24px] bg-[rgb(var(--vx-warn)/0.18)] px-4 text-xs font-semibold uppercase tracking-wider text-amber-300">Dev</span>}
            {step === "live" && (
              <span title={phase === "reasoning" ? "Clinical Reasoning time left" : "Session time"}
                className={`flex h-12 items-center gap-2 rounded-[24px] bg-[rgb(var(--vx-cell))] px-5 font-mono text-base tabular-nums ${clockTone}`}>
                <Clock className="size-[18px] opacity-70" />{phase === "reasoning" ? clock(Math.max(0, crLeft)) : clock(seconds)}
              </span>
            )}
            {step === "live" && (
              <Button size="lg" variant={chatOpen ? "default" : "secondary"} aria-pressed={chatOpen} onClick={() => setChatOpen((o) => !o)} title="Transcript" className="px-5">
                <MessageSquare /> <span className="hidden sm:inline">Transcript</span>
              </Button>
            )}
            <Button size="lg" onClick={exit} title="Leave the room" className="bg-[rgb(var(--vx-danger))] px-5 text-white"><LogOut /> <span className="hidden sm:inline">Leave</span></Button>
          </ButtonGroup>
        )}
      </header>

      <Journey phase={phase} started={step === "live"} />
      <main className="flex-1 min-h-0 w-full flex flex-col lg:flex-row">
        <section className="relative flex-1 min-w-0 min-h-[55vh] lg:min-h-0 bg-black flex flex-col">
          <div className="relative flex-1 grid place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,.10),transparent_60%)]">
            <StageBanner phase={phase} started={step === "live" && active} />
            <video ref={video} autoPlay playsInline className={`absolute inset-0 w-full h-full object-contain ${hasVideo ? "" : "hidden"}`} />

            {step === "intro" && (
              <IntroCard title={TITLE} patient={PATIENT} initials={initials(PATIENT)} firstName={learner.trim()}
                onStart={() => (learner.trim() ? start() : setStep("name"))} disabled={!FLOW_KEY} />
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
              <Presence name={SPEAKER[talking] || PATIENT} initials={SPEAKER[talking] ? "AI" : initials(PATIENT)} state={state}
                label={state === "ended" ? "The session has ended." : state === "connecting" || !active ? "Connecting…" : state === "speaking" ? "Speaking" : ""} />
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

            {/* One results view: reflection, history-taking feedback (released only after the reflection), Clinical Reasoning */}
            {modal === "results" && (
              <Results tab={tab} setTab={setTab} phase={phase} reflection={reflection} reflectionSaved={reflectionSaved}
                feedback={feedback} cr={cr} crUnreadable={phase === "cr_feedback" && !cr}
                onReasoning={startReasoning} canReason={active && !!feedback && reflectionSaved && phase === "feedback"}
                onExit={exit} onClose={feedback ? () => setModal(null) : null}
                onReport={SESSION_ID && feedback ? () => setReportOpen(true) : null}
                insight={insight} onSaveMine={(body) => saveMine(insight?.recordId, body)} htTurns={htTurns} />
            )}
            {reportOpen && (
              <React.Suspense fallback={null}>
                <PdfViewer url={`/api/sessions/${encodeURIComponent(SESSION_ID)}/report.pdf`} fetchPdf={fetchReport}
                  title="History Taking Feedback Report" subtitle={TITLE} filename="feedback-report.pdf" onClose={() => setReportOpen(false)} />
              </React.Suspense>
            )}
          </div>

          {step === "live" && (
            <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="rp-rise flex flex-wrap items-center justify-center gap-3">
              {!active ? (
                <Button size="lg" onClick={start} disabled={!FLOW_KEY || state === "connecting"} className="px-8">
                  <Play /> {state === "ended" || state === "error" ? "Start again" : "Connecting…"}
                </Button>
              ) : (
                <>
                  <ButtonGroup>
                    <Button size="lg" variant="secondary" onClick={toggleMute} title={muted ? "Unmute" : "Mute"} aria-pressed={muted}
                      className={`w-14 px-0 ${muted ? "bg-[rgb(var(--vx-danger)/0.2)] text-red-300" : ""}`}>{muted ? <MicOff /> : <Mic />}</Button>
                    <Button size="lg" variant={captions ? "soft" : "secondary"} onClick={() => setCaptions((c) => !c)} title="Captions" aria-pressed={captions} className="w-14 px-0"><Captions /></Button>
                    {phase === "consult" && <Button size="lg" onClick={endVisit} className="bg-[rgb(var(--vx-danger))] px-7 text-white"><PhoneOff /> End session</Button>}
                    {phase === "reflection" && nextBtn("Finish reflection", finishReflection)}
                    {phase === "feedback" && !modal && nextBtn("Your results", () => setModal("results"))}
                    {phase === "reasoning" && nextBtn("Finish Clinical Reasoning", endReasoning)}
                    {phase === "cr_feedback" && !modal && nextBtn("Your results", () => { setTab("reasoning"); setModal("results"); })}
                    {(phase === "cr_feedback" || (phase === "ending" && waitedLong) || (phase === "cr_ending" && waitedLong)) && exitBtn}
                  </ButtonGroup>
                  {phase === "ending" && !waitedLong && waiting("Preparing your self-reflection…")}
                  {phase === "cr_ending" && !waitedLong && waiting("Preparing your Clinical Reasoning feedback…")}
                </>
              )}
              </div>
            </div>
          )}
          {!FLOW_KEY && <p className="text-center text-xs text-red-300 pb-3">VITE_VOXIO_TEST_FLOW_KEY is missing in .env.</p>}
          {error && <p className="absolute bottom-20 inset-x-0 z-10 text-center text-xs text-red-300 px-4">{error}</p>}
          <audio ref={audio} autoPlay />
        </section>

        {(chatOpen || DEV) && step === "live" && (
          <aside className="vr-in w-full lg:w-[420px] xl:w-[460px] shrink-0 min-h-0 flex flex-col border-l border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))]">
            {chatOpen && (
              <div className="flex-1 min-h-[20rem] lg:min-h-0 flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-[rgb(var(--vx-line))] font-semibold flex items-center justify-between">
                  <span>Transcript</span>
                  <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)} title="Close" className="w-9 px-0"><X /></Button>
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
                          <div className={`rounded-2xl px-4 py-2.5 text-base leading-relaxed ${t.who === "you" ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))] rounded-br-md" : "bg-[rgb(var(--vx-cell))] rounded-bl-md"} ${t.final ? "" : "opacity-70"}`}>
                            {t.text || <span className="inline-flex gap-1"><span className="animate-bounce">·</span><span className="animate-bounce [animation-delay:120ms]">·</span><span className="animate-bounce [animation-delay:240ms]">·</span></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottom} />
                </div>
                {/* typing stays as a fallback when the mic is not an option */}
                <form onSubmit={typed} className="border-t border-[rgb(var(--vx-line))] p-4 flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} disabled={!active} placeholder={!active ? "Not connected" : `Type to the ${speaker}…`} className="h-12 flex-1 rounded-[24px] bg-[rgb(var(--vx-cell))] px-5 text-base placeholder:text-[rgb(var(--vx-muted))] outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))] disabled:opacity-50" />
                  <Button type="submit" size="lg" disabled={!active || !text.trim()} title="Send" className="w-12 px-0"><Send /></Button>
                </form>
              </div>
            )}

            {DEV && <FlowPanel open={devOpen} onToggle={() => setDevOpen((o) => !o)} events={events} live={live} moving={moving} fill={!chatOpen} />}
          </aside>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Boundary><Room /></Boundary>);
