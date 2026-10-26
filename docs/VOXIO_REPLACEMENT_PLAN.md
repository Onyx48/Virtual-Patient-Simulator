# Voxio replaced by our own backend

Status: **done on the backend.** Voxio is no longer called anywhere. The patient, the feedback and the follow-up tutor now run on our own server, using the same prompts.

## What changed

| | Before | Now |
|---|---|---|
| Who plays the patient | Voxio | our backend |
| Where the conversation is stored | Voxio | our database (`simconversations`) |
| Feedback and score on the dashboard | never saved for student sessions | saved after every turn |
| Creating a scenario | also published to Voxio | nothing to publish; the scenario just gets a simulator key (`sim_...`) |
| AI provider | Groq through Voxio | Groq if `GROQ_API_KEY` is set, otherwise Gemini; each is the other's backup |

Prompts now live in `backend/ai/prompts/sim-patient.md`, `sim-feedback.md` and `sim-reasoning.md`. The engine is `backend/utils/simEngine.js`.

## What the game developer has to change

**The base address, and how replies are read.** Requests are the same as Voxio's. Successful replies are now a single JSON object holding only what is said: `{"speak": "..."}`.

- Old: `https://chat.voxio.in`
- New: our backend, for example `https://vpsbackend.metawingsxr.com`

| Path | Also available at |
|---|---|
| `POST /agents/start_session` | `POST /api/chat/start_session` |
| `POST /agents/process_input` | `POST /api/chat/process_input` |
| `GET /agents/session?session_id=` | `GET /api/chat/session?session_id=` |

How it works (same as Voxio):
1. `start_session` with `{"api_key": "...", "session_id": "..."}`. The `api_key` picks the scenario, as it does on Voxio. The `session_id` is optional, and a UUID is created if it's missing. Starting the same `session_id` again restarts the conversation.
2. `process_input` with `{"session_id": "...", "user_input": {"user_input": "student's words"}}`. Before the visit ends, the patient answers. When it ends, the feedback and score come back in the same reply. After that, the tutor answers.

- `start_session` returns `{"speak": "Hi"}`.
- `process_input` returns `{"speak": "..."}`: the patient's line, or the tutor's reply once feedback has been given.
- No `end_diagnosis`, feedback or score is included. The game gets feedback and the score from `POST /api/sessions/feedback`, as before.
- Error replies are still the same as Voxio's: 400 for no key, 500 for an unknown key, 404 `Session not found or expired`, and 422 for a missing field.

`/api/sessions/feedback`, `/api/sessions/reasoning` and `/api/sessions/complete` are unchanged for the game.

## Tested against Voxio itself
Before replies were trimmed to `speak` only, `node scripts/compareWithVoxio.mjs` sent the same requests to `chat.voxio.in` and to our backend, then compares the two. In 12 checks there were **no differences** in status codes, content type, number of lines, line structure, error bodies or JSON formatting. Those checks covered errors, starting a session with and without a session id, a turn with bad input, a patient turn, ending the session (with feedback and score), a tutor question, and a restart. Only the wording differed, because the AI writes it fresh each time. Since the trim, the script will report differences on successful replies on purpose; error replies still match.

Also tested earlier:
- the full student flow through `/api/sessions/feedback` and `/api/sessions/reasoning`;
- the result being saved to the dashboard.

Not tested: `/api/sessions/complete` (it needs a token from a real game run) and the real game itself.

## Before going live: a paid AI key
The Gemini key in `.env` is on Google's free plan:
- `gemini-2.5-flash`: **20 requests a day** and 5 a minute. Testing used up the whole day's allowance after about 3 sessions.
- `gemini-2.5-flash-lite` is no longer available to new keys. `gemini-3.5-flash-lite` works (set `GEMINI_SIM_MODEL`).

A consultation is about 10 to 15 AI calls, so live use needs either:
- a **Groq key** (`GROQ_API_KEY`): the same model Voxio used, so behaviour stays the same; or
- **billing turned on** for the Gemini key.

## Older scenarios
Scenarios created before the switch keep their old Voxio key as their simulator key. They run on the new engine without any changes, because the engine reads each scenario's saved prompt and questions.
