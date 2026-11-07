# Voxio pipeline (branch `voxio/dev`)

On this branch every simulator session runs on Voxio. The game calls our server exactly as before. Our server drives the scenario's Voxio flow and records the results for the dashboards.

## What happens, in order

1. **An educator saves a scenario.** Our server builds the scenario's Voxio flow from what is saved, and creates or updates it on Voxio in the background. The flow's key becomes the scenario's `api_key`. If Voxio is down, the scenario still saves, and the flow is made the next time the scenario is saved or tested.
2. **A student presses Start, or an educator presses Test.** If the scenario has no working flow yet, it is made on the spot. The game is handed the flow key, as before.
3. **The consultation.** The game calls `start_session` and `process_input` on our server, which passes each turn to Voxio. The reply is `{"speak": "..."}`. If the game also sends `"avatar": true`, the reply includes the 3D avatar cues:
   ```json
   {"speak": "It only goes up to here and it hurts.", "movement": ["shoulder.flexion"], "expression": "pain"}
   ```
   - **movement:** set when the student asks the patient to move. The value is `region.movement` from the 7 animated regions. The game plays it with the scenario's limits, which come from `animationTriggers`.
   - **expression:** one of neutral, pain, worried, frustrated, relieved, happy or confused.
4. **End Session.** The patient says goodbye and Voxio starts grading in the background.
5. **Self-reflection (optional; the game decides).** The game calls `reflection/start`, then sends the learner's answers through `process_input`, then `[END_OF_REFLECTION]`. The closing line comes back at once. The self-rating and summary are saved a moment later.
6. **Feedback.** `/api/sessions/feedback` returns `{feedback, score, sc}` as before. Per-question Yes/Partly/No results are saved for educators.
7. **Clinical reasoning.** `/api/sessions/reasoning` works as before.

Everything is copied onto the student's session record: transcript, feedback, score, per-question results and reflection.

## What changes per scenario ("dynamic")

| Setting | What it changes |
|---|---|
| Case text, feedback questions, learning objectives | The patient, the grading and the reflection guide |
| **Profession** (PT or OT, on the scenario form) | The AI's case style, the standard questions (24 + 5 for PT, 25 + 5 for OT), and the wording of every step (student, patient or client) |
| **Language** (from the scenario) | Every step speaks Japanese for a Japanese scenario. Listening is set to Japanese plus English, and the greeting is こんにちは |
| **Patient gender** | Which voice and which avatar faces are used, when set in `.env` |

## Voice and avatar

- **Listening:** Soniox, in the scenario's language. This is set on each flow.
- **Speaking:** set a voice per language and gender in `.env` (`VOXIO_TTS_VOICE_EN_FEMALE` and so on). Without one, Voxio's default voice is used.
- **Voice sessions** can run straight against Voxio's voice service using the flow key. Their results reach the dashboard through the webhook, which needs `PUBLIC_API_URL` and `VOXIO_WEBHOOK_SECRET`.
- **3D avatar (Unreal):** reads `movement` and `expression` from each reply.
- **Voxio's own 2D talking avatar** is optional: set `VOXIO_FACES_MALE` / `VOXIO_FACES_FEMALE`.

## Updating existing scenarios

```bash
node scripts/syncVoxioFlows.mjs           # dry run: lists what it would do
node scripts/syncVoxioFlows.mjs --apply   # creates or updates every flow
```

Scenarios that already have a Voxio key keep it; their flow is updated in place.

**Warning:** `--apply` also updates the flows the live game uses today. Run it only when this branch goes live.

## Files

- `backend/utils/voxioFlow.js`: builds the flow (workflow, voice, avatar)
- `backend/utils/voxioSync.js`: creates or updates the flow when a scenario is saved
- `backend/utils/voxioEngine.js`: runs a session on Voxio and records results
- `backend/utils/voxioClient.js`: calls to Voxio
- `backend/utils/voxioState.js`: reads Voxio's stored conversation
- `backend/routes/voxioWebhookRoutes.js`: `POST /api/voxio/webhook`
- `backend/utils/profession.js` and `backend/ai/prompts/profession-ot.md`: PT/OT
