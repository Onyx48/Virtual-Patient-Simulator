// Microphone check before a student's session (docs/STUDENT_SCREENS.md, mindsets/student.md S6):
// a live level meter so they know they are heard before the simulator opens. Any Start calls
// requestStart(id); <MicCheckHost/> (mounted once in Container) shows this, then starts.
import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Play, Loader2 } from "lucide-react";
import { Button, ButtonGroup, Dialog } from "../vx/ui";
import { startSession } from "../../roles/student/scenarios/ScenrioGridStudent";
import { cn } from "../../lib/utils";

const SKIP_KEY = "vps.micCheck.skip";
const skipping = () => { try { return localStorage.getItem(SKIP_KEY) === "1"; } catch { return false; } };

/** Start a session, with the mic check first unless the student turned it off. */
export function requestStart(scenarioId) {
  if (skipping()) return startSession(scenarioId);
  window.dispatchEvent(new CustomEvent("vps-start", { detail: scenarioId }));
  return undefined;
}

const BARS = 24;
// Loudness in dB (RMS of the waveform), mapped from -58 dB (silence) to -12 dB (loud speech) onto
// 0..1, so ordinary speech fills half to three quarters of the meter.
const FLOOR_DB = -58, CEIL_DB = -12;

function Meter({ onHeard }) {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [state, setState] = useState("asking"); // asking | live | denied | none
  const [heardNow, setHeardNow] = useState(false);
  const [voiced, setVoiced] = useState(0); // 0..1 progress towards "we heard you"
  useEffect(() => {
    let stream, ctx, raf, smooth = 0, hold = 0, holdUntil = 0, speechMs = 0, last = performance.now(), done = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.3;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        setState("live");
        const tick = (now) => {
          const dt = Math.min(100, now - last); last = now;
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
          const target = Math.max(0, Math.min(1, (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));
          // Fast attack, slow release: rises with the voice and falls gently, no flicker.
          smooth = target > smooth ? smooth + (target - smooth) * 0.55 : smooth + (target - smooth) * 0.08;
          if (smooth >= hold || now > holdUntil) { hold = smooth; holdUntil = now + 900; }
          // About one second of speech in total, not one loud click, before we say "ready".
          if (smooth > 0.35) speechMs += dt;
          if (!done) {
            setVoiced(Math.min(1, speechMs / 1000));
            if (speechMs >= 1000) { done = true; setHeardNow(true); onHeard(); }
          }
          setLevel(smooth); setPeak(hold);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setState(e?.name === "NotFoundError" ? "none" : "denied");
      }
    })();
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "denied" || state === "none") {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-[rgb(var(--vx-warn)/0.12)] px-4 py-3 text-base text-[rgb(var(--vx-warn))]">
        <MicOff size={20} className="mt-0.5 shrink-0" />
        {state === "none" ? "No microphone found. Plug in a headset, then try again." : "The browser blocked the microphone. Allow it from the icon in the address bar, then try again."}
      </p>
    );
  }
  const lit = Math.round(level * BARS), peakBar = Math.min(BARS - 1, Math.round(peak * BARS) - 1);
  const tone = (i) => (i >= BARS * 0.88 ? "bg-[rgb(var(--vx-danger))]" : heardNow ? "bg-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-accent))]");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center">
          {/* A ring that grows with the voice */}
          <span className="absolute inset-0 rounded-full bg-[rgb(var(--vx-accent)/0.25)] transition-transform duration-75" style={{ transform: `scale(${1 + level * 0.45})` }} />
          <span className={cn("relative grid size-11 place-items-center rounded-full", heardNow ? "bg-[rgb(var(--vx-ok))] text-white" : "bg-[rgb(var(--vx-card))] ring-1 ring-[rgb(var(--vx-line))]")}>
            {state === "asking" ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
          </span>
        </span>
        <div className="flex h-12 flex-1 items-end gap-[3px]" aria-label="Microphone level" role="meter" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
          {Array.from({ length: BARS }).map((_, i) => (
            <span key={i} style={{ height: `${28 + (i / (BARS - 1)) * 72}%` }}
              className={cn("flex-1 rounded-full transition-colors duration-75", i < lit ? tone(i) : i === peakBar && peak > 0.05 ? cn(tone(i), "opacity-60") : "bg-[rgb(var(--vx-cell))]")} />
          ))}
        </div>
      </div>
      {!heardNow && state === "live" && (
        <div className="h-1 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]" aria-hidden>
          <div className="h-full rounded-full bg-[rgb(var(--vx-ok))] transition-[width] duration-150" style={{ width: `${voiced * 100}%` }} />
        </div>
      )}
      {state === "live" && peak >= 0.9 && <p className="text-sm text-[rgb(var(--vx-danger))]">Very loud: move the microphone a little further away.</p>}
    </div>
  );
}

export function MicCheckHost() {
  const [id, setId] = useState(null);
  const [heard, setHeard] = useState(false);
  const [skip, setSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = (e) => { setId(e.detail); setHeard(false); setSkip(false); };
    window.addEventListener("vps-start", on);
    return () => window.removeEventListener("vps-start", on);
  }, []);
  if (!id) return null;
  const go = async () => {
    if (skip) { try { localStorage.setItem(SKIP_KEY, "1"); } catch { /* private window */ } }
    setBusy(true);
    await startSession(id);
    setBusy(false);
    setId(null);
  };
  return (
    <Dialog title="Check your microphone" subtitle="Say a sentence out loud, as you would to a patient." onClose={() => setId(null)} size="sm"
      footer={
        <ButtonGroup>
          <Button variant="secondary" size="lg" onClick={() => setId(null)}>Cancel</Button>
          <Button size="lg" onClick={go} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Play />} {heard ? "Start session" : "Start anyway"}</Button>
        </ButtonGroup>
      }>
      <div className="flex flex-col gap-4">
        <Meter onHeard={() => setHeard(true)} />
        <p className={cn("text-base", heard ? "font-medium text-[rgb(var(--vx-ok))]" : "text-[rgb(var(--vx-muted))]")}>
          {heard ? "We can hear you clearly. You are ready." : "Keep talking until the green line fills. A quiet room and a headset help the patient understand you."}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--vx-muted))]">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="size-4 accent-[rgb(var(--vx-accent))]" />
          Don't ask me again on this computer
        </label>
      </div>
    </Dialog>
  );
}
