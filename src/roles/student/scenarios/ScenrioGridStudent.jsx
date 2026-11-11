// A student's scenario cards, in the vx design. Same data shape as before
// ({ id, scenarioName, description, difficulty, highestScore, status, testable }).
import React from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Play, RotateCcw, BarChart3, Lock } from "lucide-react";
import { useNavigate } from "../../../lib/router";
import { Button, ButtonGroup } from "../../../components/vx/ui";
import { Ago } from "../../../components/vx/bits";
import { requestStart } from "../../../components/shared/MicCheck";
import { getAuthHeaders, cn } from "../../../lib/utils.js";

const muted = "text-[rgb(var(--vx-muted))]";
const norm = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const showDescription = (s) => !!s.description && norm(s.description) !== norm(s.scenarioName);

// Only scenarios the backend has enabled can run (backend/utils/testableScenarios.js); fail closed.
export const canRun = (s) => s?.testable === true;
export const NOT_RUNNABLE = "Not open for practice yet. Your educator will enable it.";
export const difficultyLabel = (d) => ({ high: "Hard", low: "Easy", medium: "Medium" }[String(d || "").toLowerCase()] || d || "Medium");

/** Opens the simulator in a new tab for this scenario. */
export async function startSession(scenarioId) {
  try {
    const { data } = await axios.post("/api/sessions/start", { scenario_id: scenarioId }, getAuthHeaders());
    if (!data?.redirect_url) throw new Error("The server did not say where the simulator is.");
    window.open(data.redirect_url, "_blank", "noopener,noreferrer");
  } catch (error) {
    toast.error(error?.response?.data?.message || error.message || "Could not start the session.");
  }
}

function Bars({ level }) {
  const n = { easy: 1, medium: 2, hard: 3 }[difficultyLabel(level).toLowerCase()] || 2;
  return (
    <span className="flex items-end gap-[2px]" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-1 rounded-sm", i <= n ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-line))]")} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

export default function ScenarioGridStudent({ data, onStartNow }) {
  const navigate = useNavigate();
  const open = (id) => navigate(`/student/scenario/${id}`);
  const start = (id) => (onStartNow ? onStartNow(id) : requestStart(id));

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] px-5 py-16 text-center">
        <p className={cn("text-base", muted)}>No scenarios here yet. Your educator assigns them.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {data.map((s) => {
        const done = s.status === "Completed";
        const runnable = canRun(s);
        return (
          <li key={s.id} role="button" tabIndex={0} onClick={() => open(s.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(s.id); } }}
            className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5 transition-[border-color,box-shadow] hover:border-[rgb(var(--vx-accent)/0.6)] hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-medium",
                done ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-accent)/0.15)]")}>
                {done ? "Done" : "To do"}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 text-sm", muted)}><Bars level={s.difficulty} /> {difficultyLabel(s.difficulty)}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="line-clamp-2 text-xl font-semibold leading-snug">{s.scenarioName}</h3>
              {showDescription(s) && <p className={cn("line-clamp-2 text-sm", muted)}>{s.description}</p>}
            </div>
            <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {s.highestScore == null
                ? <span className={muted}>Not tried yet</span>
                : <span>Best <b className="tabular-nums">{s.highestScore}%</b>{s.attempts ? <span className={muted}> · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}</span> : null}</span>}
              {s.lastAt && <span className={muted}><Ago date={s.lastAt} /></span>}
            </p>
            {done ? (
              <ButtonGroup className="w-full">
                <Button variant="secondary" className="flex-1" onClick={(e) => { e.stopPropagation(); open(s.id); }}><BarChart3 /> Results</Button>
                <Button className="flex-1" disabled={!runnable} title={runnable ? undefined : NOT_RUNNABLE}
                  onClick={(e) => { e.stopPropagation(); start(s.id); }}>{runnable ? <RotateCcw /> : <Lock />} Again</Button>
              </ButtonGroup>
            ) : (
              <Button className="w-full" disabled={!runnable} title={runnable ? undefined : NOT_RUNNABLE}
                onClick={(e) => { e.stopPropagation(); start(s.id); }}>{runnable ? <Play /> : <Lock />} {runnable ? "Start" : "Not open yet"}</Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
