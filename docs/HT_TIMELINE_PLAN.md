# History-taking timeline: plan

Per-turn scoring of the history-taking conversation, recorded silently and shown **after** the session as a graph, built the way ci/internal-shortlisting builds its interview replay. Nothing is shown or said to the student during the case.

## 1. How ci does it (read from `D:\ci\internal-shortlisting`)

| Piece | File | What it does |
|---|---|---|
| Rubric | `lib/interviews/rubric.ts` | The one list of dimensions `{key, label, blurb, color}`. Every chart, roll-up and prompt reads it; nothing hardcodes a key. `rubricFor(track)` throws on an unknown track rather than falling back. |
| Kinks | `lib/interviews/rubric.ts` | A score moves only on a **kink**: a named event with a description. Five closed types: `suggestion` (no move), `acknowledged` (+1/+2), `adopted` (+2/+3), `demonstrated` (+2/+3, "Strength"), `repeated` (0/−1). Colours: warning / success / success / success / destructive. Unknown types are discarded. |
| Turn status | same | `scored` (a kink), `empty` (valid, nothing happened: the normal case), `failed` (no parseable output). `failed` turns are never plotted. |
| Scorer | `lib/interviews/customs.ts` `llm_score` + `SCORING_PROMPT` | A **second LLM node** that never speaks. Runs after the interviewer's reply has gone to TTS (`llm → response → llm_score → score_out → …`), reads `user_input` + the final `speak`, has its own `history_key` so it sees its previous scores and carries them forward. Model `google/gemini-3.1-flash-lite-preview` via OpenRouter. |
| Scoring rules | `SCORING_PROMPT` | Start at 0, earned upward. No kink, no movement. Max +3 / −1 per turn, decimals allowed. A drop needs a pattern over 2+ turns, never one bad (possibly mis-transcribed) answer. At most 2 kinks per turn. Return all 5 dimensions every turn. |
| Vision | `customs.ts` `vision_id` | Gemini flash-lite at 1 fps on the camera; reports only posture, face direction, visibility, hands; never mood or confidence; stops if more than one person is visible. The report rides inside `user_input` in a `<turn-visual-context>` tag, stripped before the transcript is stored. Only source for `posture`. |
| Roll-up | `lib/interviews/session.ts` `finaliseScores` | Re-applies "no kink, no movement" in code: a dimension's value is read only from turns where it had a kink, so a model that drifts to 0 cannot wipe a score. Marks the session `partial` if any turn failed. |
| Graph | `components/interviews/kink-timeline.tsx` | Hand-drawn SVG (not recharts), viewBox 960×300, y 0–10 with gridlines at 0/2.5/5/7.5/10. One line per dimension, **stepped**: holds its value and moves only on a kink turn. Each line drawn twice (7px blurred at 40% "backlight" + 2px crisp). Kink dots (r 5, coloured by kink type, background stroke) sit **on their dimension's line** at the new score, fanned apart only where they would overlap (`fanOut`, min gap 15). One hover column per turn (28 units wide) dims the other lines and shows a card: "Turn 7 · 2 moments", per kink the dimension dot, label, kink label in its colour, score and description. Click a column to jump. A playhead follows a recording. Needs 2+ scored turns, else a dashed empty state. |
| Around it | `components/interviews/interview-replay.tsx` | The timeline under the video, plus a radar and weakest-first bars (recharts). |

## 2. VPS rubric: the five dimensions

Declared once in `src/lib/htRubric.js` (mirrors ci's `rubric.ts`), same shape. Scored only during history taking (the `patient` phase), not reflection or clinical reasoning.

| key | Label | What it records (student-side evidence) |
|---|---|---|
| `questioning` | Questioning | Opens broad then narrows; one question at a time; no leading or double questions; lets the patient finish. |
| `coverage` | Coverage | The turn moves the history into a new area: onset and mechanism, pain behaviour, aggravating and easing, 24-hour pattern, past history, medication, red flags, social and work, the patient's goals. Repeating an area already covered earns nothing. |
| `listening` | Listening | Picks up a cue the patient just gave (a worry, a hint), reflects it, follows it up, summarises at the right time. |
| `rapport` | Patient-centred | Acknowledges pain or worry, plain language instead of jargon or explains it, checks understanding, explains what comes next. |
| `presence` | Presence | **Camera only.** Facing the camera, clearly visible and lit, not looking away or reading for most of the turn. Never eye-contact intensity (it penalises Japanese students' politeness), never mood. |

**Kink types for VPS.** Our patient never coaches, so ci's interviewer-side types (`suggestion`, `repeated`) have no evidence source. We keep only the student-side ones, which removes the "marked down for advice nobody gave" problem entirely:

| type | Label | Move | When |
|---|---|---|---|
| `demonstrated` | Strength | +2 / +3 | Did it well; a real assessor would have noticed. |
| `partial` | Attempted | +1 / +1.5 | A genuine but imperfect attempt (an open question followed by a leading one). |
| `slipped` | Slipped | 0 / −1 | The same weakness on a second separate turn (pattern only, never a single turn). |

Colours: `demonstrated` success, `partial` warning, `slipped` destructive, exactly as ci colours its good / neutral / bad kinks.

## 3. Flow change (`backend/utils/voxioFlow.js`)

Today: `input1 → patient → [response1, judge]`, `judge: no → input1`.

New, sequential like ci:

```
patient → response1 → ht_score → score_out → judge
```

- `ht_score`: `type: "llm"`, `history_key: "ht_score_history"` (separate from the patient's), `input_variables`: `user_input` and the patient's final `speak`. Model: OpenRouter `google/gemini-3.1-flash-lite-preview`, same as ci. `llm_return_type`: one dict per dimension `{ type_, score, description }`, plus `turn: int`.
- `score_out`: `out` of the five dimension variables, so the room receives them as a packet.
- System prompt `backend/ai/prompts/ht-scorer.md`: ci's `SCORING_PROMPT` adapted. Kept word for word in spirit: starts at zero; no kink, no movement; +3/−1; decimals; a drop needs a pattern; at most two kinks per turn; return all five; carry forward. Changed: no interviewer and no checkpoints (student-side kinks only), the five dimensions above, and "the greeting and small talk are not scored".
- `presence` is scored only when a `<turn-visual-context>` block is present; otherwise it gets no kink.
- **Voxio timing risk** (found earlier this project): a new user input while a turn is running claims a new generation and drops the old turn's state. Putting `ht_score` after `response1` means the patient is already speaking while it runs, and flash-lite is quick, but a student who answers instantly can still cut a score. Those turns arrive without a `score_out` and are recorded as `failed`, never as zero, exactly ci's rule. If that shows up often, move scoring out of the flow and run it from the backend on the stored transcript after each turn (`voxioEngine.js` already runs per turn in the background).

## 4. Camera (optional, off by default)

- Add `vision_id` to the room customs only when the school has it enabled (`School.visionScoring: false` by default). ci's vision prompt is reused with its four checks narrowed to three (facing, visibility, not reading or looking away), "never infer mood" kept verbatim, and the multi-person stop kept.
- The room already opens the session with `media: { video: true }`; check whether the student's camera is sent upstream or only the avatar video comes down, and enable sending only for vision schools.
- Frames are not stored. The visual tag is stripped before the transcript is saved (as ci's webhook does).
- Students see a one-line notice before the session: "Your camera is used to give feedback on presence. Video is not recorded."

## 5. Storage

`Session` (`backend/models/sessionModel.js`) gets:

```js
htTurns: [{ turn: Number, at: Number /* seconds from start */, status: { type: String, enum: ["scored", "empty", "failed"] },
            scores: Schema.Types.Mixed /* { questioning: { type_, score, description }, … } */ }],
htScoringState: { type: String, enum: ["unscored", "partial", "complete"] },
htFinal: Schema.Types.Mixed, // { questioning: 6.5, … } from finaliseHt
```

- The room posts each `score_out` packet with its turn number and elapsed seconds to `POST /api/sessions/:id/ht-turn`. Unknown kink types are cleared (`isKinkType`) and a missing packet stores `failed`.
- `finaliseHt(session)` in `backend/utils/htTimeline.js` is a port of `finaliseScores`: a value is read only from kink turns, `partial` if any turn failed. It runs when history taking ends.

## 6. The graph (`src/components/feedback/KinkTimeline.jsx`)

A **straight port of `kink-timeline.tsx` to JSX**, so it looks identical:

- the same viewBox (960×300), margins, gridlines and 0–10 axis;
- the same stepped carry-forward lines with the blurred backlight under a 2px line;
- the same kink dots on the line, `fanOut` separation, halo on hover, one column hit target per turn, the hover card layout and the dimming of other lines;
- the same empty state.

Only the colours change: the dimension colours become our five series tokens in `vx.css` (`--vx-series-1…5`, chosen with the dataviz validator), and the kink colours use `--vx-ok` / `--vx-warn` / `--vx-danger`.

- **No recording, so no video seek:** clicking a kink column scrolls the transcript beside the graph to that turn and highlights it. The playhead is left out.
- **Legend:** chips under the chart toggle each dimension (`hiddenDimensions`), as ci's replay does.
- **Next to it** (recharts, as in ci): the final scores as weakest-first bars. A radar is optional; with 4–5 dimensions the bars read better.

**Where it shows:**

| Who | Where |
|---|---|
| Student | Feedback Summary in the room, after the history-taking feedback, as a "How the conversation went" panel. Also on their session detail page. |
| Educator | The same panel on the session page. The class view adds an average line per dimension across the cohort, later. |

## 7. Build order

1. `htRubric.js` with the dimensions and kink types, and `ht-scorer.md` adapted from ci's prompt.
2. `ht_score` and `score_out` in the flow. Check against customs (200 OK) and run one live session reading the packets.
3. Session fields, the `ht-turn` endpoint and `finaliseHt`.
4. `KinkTimeline.jsx` port, legend, weakest-first bars, and the feedback-panel placement.
5. Camera: the `vision_id` toggle per school, the notice, and the `presence` dimension. Ship this last and separately; without vision, `presence` is hidden, not drawn at 0. ci's comment warns that a dimension at 0 reads as a finding about the student.

## 8. Open decisions

- Does the timeline feed the graded HT mark, or stay coaching only? Recommended: coaching only at first, and compare it against educators' marks over a term before linking them.
- Camera on for which schools first, and who signs off on consent (SIT ethics, partner hospitals)?
- Cost: one flash-lite call per turn (about 20–30 per session), plus 1 fps vision where enabled.
