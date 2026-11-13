# Simulator API — what the game calls

For the StreamPixel / Unreal build. Base URL (dev): **`https://dev.backend.proroleplay.com`**

These replace `https://chat.voxio.in/agents/...` one-for-one: same paths, same request bodies — only the base URL changes. None of them needs a login token. Every `/agents/...` path also works as `/api/chat/...`.

| Step | Method | Path | Purpose |
|---|---|---|---|
| 1 | GET | `/api/scenarios/json` | Which scenario and session to run |
| 2 | POST | `/agents/start_session` | Start (or restart) the consultation |
| 3 | POST | `/agents/process_input` | One student turn → the patient's reply + movement |
| – | GET | `/agents/session?session_id=<id>` | Optional: session state |
| – | GET | `/agents/health` | Optional: health check |

## How the game is launched

The dashboard opens the simulator when a student presses **Start** (or an educator presses **Test**):

```
https://share.streampixel.io/6aa15b2580d62d728d8bc5f8?room=<session_id>&language=<code>
```

`language` is the scenario's ISO 639-1 code (`en`, `ja`, `hi`, …), left off when unknown. The game does not call this URL; it is opened with it.

## 1. GET `/api/scenarios/json`

```json
{
  "api_key": "sim_…",
  "session_id": "6af3c1e2a9b4c70012345678",
  "patient_name": "…",
  "gender": "Male",
  "language": "English",
  "language_code": "en",
  "environment": "…",
  "model": "…"
}
```

`api_key` identifies the scenario; treat it as private (it lets a caller talk to that scenario's patient).

## 2. POST `/agents/start_session`

```json
{ "api_key": "<from step 1>", "session_id": "<from step 1>" }
```

→ `200 {"speak": "Hi"}`

## 3. POST `/agents/process_input`

```json
{ "session_id": "<same id>", "user_input": { "user_input": "Turn your head to the left" } }
```

→ `200 {"speak": "It's a bit tight, but I can manage this much.", "action": "left-neck-rotation"}`

- `speak` — the patient's line, in the scenario's language.
- `action` — **one** movement for the avatar to play this turn, or `null` when the student is not asking for a movement (or asks for one outside the list, e.g. the elbow). Never more than one per turn.
- Send `"Let's end the session"` to end history taking. After that, replies come from the reasoning tutor as `{"speak": "..."}` with no `action`.

Errors: `404 {"detail":"Session not found or expired"}` for an unknown session; `422` when `session_id` or `user_input` is missing.

### Movement ids (62)

Format `[side-]region-movement`. Side is the **patient's** left/right. Source of truth: `backend/utils/movements.js`.

| Region | Ids |
|---|---|
| Shoulder (each `left-` / `right-`) | `shoulder-flexion`, `shoulder-extension`, `shoulder-abduction`, `shoulder-external-rotation`, `shoulder-internal-rotation`, `shoulder-horizontal-adduction`, `shoulder-hand-behind-back`, `shoulder-hand-behind-neck` |
| Neck | `neck-flexion`, `neck-extension`, `left-neck-rotation`, `right-neck-rotation`, `neck-protraction`, `neck-retraction`, `left-neck-lateral-flexion`, `right-neck-lateral-flexion` |
| Lower back | `lower-back-flexion`, `lower-back-extension`, `left-lower-back-lateral-flexion`, `right-lower-back-lateral-flexion`, `left-lower-back-rotation`, `right-lower-back-rotation` |
| Hip (each `left-` / `right-`) | `hip-flexion`, `hip-extension`, `hip-abduction`, `hip-adduction`, `hip-internal-rotation`, `hip-external-rotation` |
| Knee (each `left-` / `right-`) | `knee-flexion`, `knee-extension` |
| Ankle (each `left-` / `right-`) | `ankle-dorsiflexion`, `ankle-plantarflexion`, `ankle-inversion`, `ankle-eversion` |
| Foot (each `left-` / `right-`) | `foot-great-toe-extension`, `foot-great-toe-flexion`, `foot-forefoot-pronation`, `foot-forefoot-supination` |

e.g. `right-shoulder-abduction`, `left-ankle-dorsiflexion`.

## Server setup this depends on

`.env` on the server:

```env
VITE_API_BASE_URL=https://dev.backend.proroleplay.com
CORS_ORIGINS=https://dev.dashboard.proroleplay.com
```

then `pnpm build && pm2 restart all --update-env`.
