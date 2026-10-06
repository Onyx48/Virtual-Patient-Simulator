# API Changes — Simulator Handoff

How the backend communicates with the external simulator (StreamPixel / Voxio) changed significantly. The core change: **we stopped sending the entire scenario to the simulator at runtime and now only send two identifiers.**

---

## Before (old version)

When an educator pressed **Test** or a student pressed **Start**, the backend loaded the full scenario document from MongoDB and placed it in a global in-memory slot. The external simulator then polled `GET /api/scenarios/json` and received **everything**:

```
GET /api/scenarios/json  →  response:
{
  "response": {
    "cursor": 0,
    "count": 1,
    "remaining": 0,
    "results": [
      {
        "_id": "...",
        "scenarioName": "John, a 45-year-old plumber with neck pain",
        "scenarioPrompt": "... (the entire patient persona, history, instructions) ...",
        "aiQuestions": "...",
        "aiInstructions": "...",
        "aiAvatarRole": "...",
        "template": "...",
        "animationTriggers": { "shoulder": [...], "neck": [...] },
        "apiKey": "...",
        "html": "...",
        "difficulty": "Medium",
        "educator": { "name": "...", "email": "..." },
        "assignedTo": [...],
        "schoolId": "...",
        "status": "Published",
        "permissions": "Read Only",
        ... (every field on the Scenario model)
      }
    ]
  }
}
```

### What was wrong with this

- **The full patient persona, instructions, and rubric questions were exposed** on an unauthenticated endpoint — anyone who knew the URL could read them.
- **Internal fields leaked** — educator email, school ID, assignment list, status, permissions — none of which the simulator needs.
- The simulator had to parse a large nested JSON blob and extract the fields it cared about.
- The `"Scenario json"` field inside the default fallback was itself a JSON string inside a JSON string (double-encoded), carrying the entire case study.
- The handoff carried no session identity, so there was no way to tie a simulator run back to a specific student attempt.

---

## After (current version)

Scenario content is now **baked into Voxio at publish time**, not sent at runtime. When an educator creates or edits a scenario through the AI form, the backend:

1. Generates the scenario with Gemini (patient persona, prompt, feedback questions).
2. Builds a Voxio workflow (the conversation flow graph) with the persona and rubric injected.
3. Publishes that workflow to Voxio, which returns an `api_key` identifying the flow.
4. Stores only the `api_key` on the Scenario document.

When an educator presses **Test** or a student presses **Start**:

1. The backend mints a unique `session_id` for this run.
2. It sets only two values in the live slot: the scenario's `api_key` and the `session_id`.
3. The simulator polls the same endpoint and gets just two fields:

```
GET /api/scenarios/json  →  response:
{
  "api_key": "vx_abc123...",
  "session_id": "66f1a2b3c4d5e6f7..."
}
```

The simulator uses `api_key` to ask Voxio which flow to run, and `session_id` to tag the conversation so results can be matched back to the student's session record.

---

## Summary of what changed

| Aspect | Before | After |
|--------|--------|-------|
| What `GET /api/scenarios/json` returns | Full scenario document (all fields) | Only `api_key` + `session_id` |
| Where the patient persona lives at runtime | Sent to the simulator on every poll | Pre-published inside Voxio's flow |
| Authentication on the endpoint | None (same as before) | None — but nothing sensitive is exposed now |
| Session tracking | No session identity in the handoff | `session_id` minted per run, ties back to the Session record |
| Simulator isolation | None — two simultaneous users saw each other | Each run gets its own StreamPixel room via `?room=<session_id>` |
| Educator/school data exposure | Leaked (educator email, school ID, etc.) | Not sent at all |
| Scenario instructions exposure | Fully readable by anyone | Stored inside Voxio, not on the public endpoint |
| Feedback rubric exposure | Fully readable (questions_for_feedback) | Stored inside Voxio |

---

## Endpoints affected

| Endpoint | Change |
|----------|--------|
| `GET /api/scenarios/json` | Now returns `{ api_key, session_id }` instead of the full scenario |
| `POST /api/scenarios/json` | Now mints a `session_id`, sets `api_key` + `session_id` in the live slot, and returns a `simulatorUrl` to the caller |
| `POST /api/sessions/start` | Now creates a Session record up front (empty), sets the live scenario with `session_id`, and returns a `redirect_url` with a room-isolated simulator link |
| `POST /api/scenarios/ai/generate` | New — generates a scenario with Gemini and publishes it to Voxio in one step |
| `POST /api/scenarios/ai/edit` | New — regenerates and re-publishes an existing scenario's Voxio flow |

---

## What the simulator needs to do differently

**Before:** Parse the full scenario JSON from `GET /api/scenarios/json`, extract the prompt, questions, and instructions, and run the conversation locally.

**After:** Read `api_key` and `session_id` from `GET /api/scenarios/json`, then talk to Voxio's conversation API (`chat.voxio.in`) using those two values. Voxio handles the conversation, scoring, and feedback. The simulator is now a thin presentation layer — it renders the avatar and streams audio, but the AI conversation runs on Voxio's side.
