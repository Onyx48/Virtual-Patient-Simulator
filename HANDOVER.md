# Handover: Voxio migration and avatar clips (as of 2026-11-06)

Read this first in any new session. It covers everything done so far, how it works, what is pending, and the rules to follow.

---

## 0. Ground rules from the user (always follow)

- **Never echo, log or commit secrets.** The OpenRouter key, the Voxio account key and the Mongo URI all live in `.env`, which is gitignored. Don't print them.
- **Commit or push only when asked.**
- **Never run `node scripts/syncVoxioFlows.mjs --apply` on real scenarios.** It updates the flows the live game uses in production. A dry run (no flag) is safe.
- The user writes in short, typo-heavy messages. Read for intent, act, and keep replies short.
- The user corrected one wrong claim: Voxio's avatar is **2D with movement clips**, not "no movements". Check `D:\vx\vx-backend-monorepo` before claiming what Voxio can or can't do.

---

## 1. Repo and environment

- **Repo:** `D:\vps\Virtual-Patient-Simulator`, Windows. Use PowerShell or Git Bash.
- **Code location:** `D:\vps\CLAUDE.md` says the code is in `Whole_project/`. In practice the active code is at the repo root (`backend/`, `src/`, `scripts/`). Follow the root.
- **Stack:**
  - Backend: ESM Express plus Mongoose, on MongoDB Atlas (database "test").
  - Frontend: React/Vite, with pnpm.
- **Ports:** the backend normally runs on 5001, but another process held 5001 during this work, so testing used `PORT=5055`.
- **Mock accounts:** `node scripts/seedMockAccounts.mjs` seeds them. It **resets all mock data**. Super-admin: `superadmin@mock.proroleplay.test` / `Demo@1234`.

### Branches
| Branch | State |
|---|---|
| `main` | upstream main |
| `dev` | local only. Commit `663edad` (feedback question grading, self-reflection, learning objectives, OpenRouter, super-admin mock account) |
| `voxio/main` | made from `dev` and pushed to origin |
| `voxio/dev` | **current branch**. Made from `dev` and pushed. **All the Voxio work below is uncommitted here.** |
| `wip-local-snapshot` | old snapshot, deliberately not merged |

Uncommitted on `voxio/dev`:
- **Modified:**
  - `.env.example`
  - `backend/index.js`
  - `backend/models/scenarioModel.js`, `schoolModel.js`
  - `backend/routes/scenarioRoutes.js`, `sessionRoutes.js`, `simRoutes.js`
  - `backend/utils/bodyRegions.js`, `simEngine.js`
  - `src/components/shared/ScenarioFormPage.jsx`
- **New:**
  - `backend/ai/prompts/profession-ot.md`, `voxio-kernel.md`
  - `backend/routes/voxioWebhookRoutes.js`
  - `backend/utils/profession.js`, `voxioClient.js`, `voxioEngine.js`, `voxioFlow.js`, `voxioState.js`, `voxioSync.js`
  - `docs/VOXIO_PIPELINE.md`, `docs/avatar/`, `scripts/syncVoxioFlows.mjs`, and this file.

---

## 2. The goal

Replace the Unreal Engine game plus our custom AI APIs with **Voxio** end to end, running everything through Voxio: patient conversation, voice, the 2D avatar with movement clips, feedback/grading, self-reflection and clinical reasoning. It must be **dynamic per scenario**:
- one Voxio flow per scenario, auto-synced on save;
- the language comes from the scenario (English or Japanese);
- the profession is PT or OT;
- the voice and avatar depend on the patient's gender.

---

## 3. What Voxio is (learned facts)

- **Data service:** `https://database.voxio.in`
  - Auth headers use **underscores**: `api_key`, `user_api_key`. Hyphens give a 422 "missing api_key".
  - `POST /flow` creates a flow and returns its `api_key` (`vk_...`), which is the flow key.
  - `PUT /flow` updates a flow. Headers: `api_key=<flowKey>` and `user_api_key=<account key>`.
  - `GET /flow?keys=...` reads a flow.
- **Chat service:** `https://chat.voxio.in`
  - Endpoints: `/agents/start_session`, `/agents/process_input`, `/agents/session` (state).
  - Responses are NDJSON. Lines look like `{"out":{...}}`, plus status lines.
  - The `start_session` stream does not close by itself, so we resolve on the first `speak` and drain the rest in the background.
- **SDK `voxioagent` v3**
  - Server side, it targets `gpu.data.voxio.in`. **Our current account gets a 404 there.** The user will provide a **new account key**; use that one.
  - Client side: `createSession({flowKey, media:{video:true}, customs, participants})`, events `agentVideo`, `reply`, `inputRequest`, and `sendText`.
  - Voice: `voice.voxio.in` / `gpu.voice.voxio.in`.
- **Workflow quirks (old deployment):**
  - Conditional `default` mappings **don't fire**.
  - A conditional that also has `next` runs **both** paths.
  - Only explicit-value mappings work, so free-text routing uses a small router step ("AI thinks", using a gpt-oss-20b-class model) that writes an explicit value.
  - `llm` nodes save their output fields to state; `out` nodes emit variables.
  - History is stored as a Python dict repr (`{'speak': ...}`). User turns are stored as `"user_input : text"`.
- **Avatar** (from `D:\vx\vx-backend-monorepo`, lipsync)
  - It is a **2D talking avatar**. Expressions and movements are **video clips**.
  - The workflow emits a **`frame`** key whose value is a clip label.
  - The idle clip **must be labelled `main`**. A gesture plays to the end, then returns to `main`.
  - Transitions are one-way `(from, to)` pairs. We avoid them by making every clip start and end on the same reference frame.
  - Clips must be **25 fps**.
  - Reference implementation: `D:\vx\tempp`, mainly `src/lib/voice/vpsCustoms.ts` and `vpsPrompt.ts`. It is a "Mr Suresh Nair" demo with frames `main`, `right-hand` and `left-hand`, and uses WebRTC to `/rtc/offer/video` with inline customs.

---

## 4. What is built (on voxio/dev, tested, uncommitted)

Full write-up: `docs/VOXIO_PIPELINE.md`.

### Flow
1. **The educator saves a scenario.**
   - `syncInBackground` builds the flow (`voxioFlow.buildFlow`) and creates or updates it on Voxio.
   - The flow key becomes the scenario's `apiKey`.
   - The status is stored in `scenario.voxioSync {status, at, error}`.
   - An existing flow key is never replaced by a non-flow key. A key starting with `sim_` counts as a non-flow key.
2. **Start or Test.** `ensureFlow` makes the flow if it is missing or unsynced.
3. **The game calls our server** (`simRoutes`), which proxies to Voxio through `voxioEngine`.
   - `process_input` with `"avatar": true` returns `{speak, movement, expression}`.
4. **End Session.** `endAndGrade` sends END (2 retries), then polls state until feedback appears. Timeout: `VOXIO_GRADING_TIMEOUT_MS`, default 120 s.
5. **Reflection.** `startReflection` sends `[START_OF_REFLECTION]` plus a clean numbered transcript. The learner's answers follow. `[END_OF_REFLECTION]` returns the closing line at once; the self-rating and summary are saved shortly after.
6. **Feedback.** `/api/sessions/feedback` returns `{feedback, score, sc}`, with per-question Yes/Partly/No results. `withBaseScore` maps 0–1 onto a 2–10 score.
7. **Reasoning.** `/api/sessions/reasoning` works as before.
8. **Webhook.** `POST /api/voxio/webhook?token=VOXIO_WEBHOOK_SECRET` calls `syncFromVoxio`.
   - It is mounted **before** the global `express.json()`, because of the 100 kb limit (this caused a 413 earlier).

### Workflow nodes (`backend/utils/voxioFlow.js` → `buildWorkflow`)

**Consultation**
- `greeting`: out node; says "Hi" / "こんにちは"; sets `expression` and `movement`.
- `input1` → `patient` (llm: `speak`, `movement` [region.movement], `expression`, `end_diagnosis`) → `response1` → `judge`.
- `judge`: yes → [`feedback`, `phase_input`]; no → `input1`.
- `feedback`: llm, silent; outputs `feedback`, `score` and `questions`.

**Phase routing**
- `phase_input` → `phase_router` → `phase_route`.
- `phase_router` sets `phase` to `reflection` if the input starts with `[START_OF_REFLECTION]`.

**Reflection**
- `reflection` (llm `speak`) → `reflection_say` → `reflection_input` → `reflection_router` → `reflection_route`.
- `reflection_route` on end: [`reflection_closing` (static CLOSING), `reflection_result` (llm: `self_rating`, `summary`, `status`, `distress_flag`, `reflection_done:"yes"`), `phase_input`].
- `reflection_route` on continue: back to `reflection`.

**Reasoning**
- `reasoning` (llm `speak`) → `response2` → `reasoning_input`.

**Supporting pieces**
- Prompts:
  - `KERNEL` comes from `backend/ai/prompts/voxio-kernel.md`.
  - Profession wording comes from `withWords`.
  - For Japanese, the feedback prompt is prefixed with "WRITE THE FEEDBACK AND EVERY EVIDENCE NOTE IN JAPANESE."
- `EXPRESSIONS`: neutral, pain, worried, frustrated, relieved, happy, confused.
- Voice:
  - Speech-to-text: Soniox `stt-rt-v4`, languages `["en"]` or `["ja","en"]`.
  - Text-to-speech voices from env: `VOXIO_TTS_VOICE_{EN|JA}_{MALE|FEMALE}`.
- Faces: `VOXIO_FACES_MALE/FEMALE`, `VOXIO_TRANSITIONS_*`.
- Webhook URL: `PUBLIC_API_URL + /api/voxio/webhook?token=...`.

### Files
| File | Role |
|---|---|
| `backend/utils/voxioClient.js` | HTTP calls: `createFlow`, `getFlow`, `updateFlow`, `isFlowKey`, `startVoxioSession`, `sendTurn`, `getVoxioState`, `isVoxioConfigured` |
| `backend/utils/voxioFlow.js` | builds the workflow, voice and faces |
| `backend/utils/voxioSync.js` | `syncScenarioFlow`, `syncInBackground` (serialised per scenario), `ensureFlow` |
| `backend/utils/voxioEngine.js` | same API as the old `simEngine`: `startSession`, `patientTurn`, `endAndGrade`, `startReflection`, `reflectionTurn`, `reasoningTurn`, `syncFromVoxio`, `sessionState` |
| `backend/utils/voxioState.js` | parses Voxio state (`parsePythonLiteral`, `gradingOf`, `reflectionOf`, transcripts) |
| `backend/routes/voxioWebhookRoutes.js` | webhook with a timing-safe token check |
| `backend/utils/profession.js` + `backend/ai/prompts/profession-ot.md` | PT/OT. OT uses 25 standard questions + 5 tagged = 30. `OT_STANDARD_QUESTION_CRITERIA` is a **DRAFT pending client sign-off** |
| `backend/utils/simEngine.js` | still exports shared helpers (`scenarioFor`, `saveToSession`, `toScore`, `CLOSING`, `numberedTranscript`, …) |
| `backend/models/scenarioModel.js` | adds `profession` (default physiotherapy) and `voxioSync` |
| `backend/models/schoolModel.js` | adds `defaultProfession` |
| `src/components/shared/ScenarioFormPage.jsx` | Profession select; profession is passed to the AI generate/edit calls. `pnpm build` passes |
| `scripts/syncVoxioFlows.mjs` | dry run by default; `--apply` and `--only id,id`. **Don't run with `--apply`** |
| `.env.example` | Voxio section: `VOXIO_*`, `PUBLIC_API_URL`, `VOXIO_WEBHOOK_SECRET` |

### Testing done
- **Mock scenarios tested.** All passed end to end on Voxio: movement and expression, reflection rating and summary, feedback, reasoning, and webhook restore.
  - PT: `6aeaf5bd73b888c473269e1a`.
  - OT: `6aeb71c14cdb841eb30472e0`, 30 questions with the OT criteria.
  - Japanese: `6aeb72934cdb841eb30472fa`.
- **Latency:** reflection start takes about 6–9 s; the closing line about 2.5 s.
- **Test flows:** these were left on the Voxio account. Real scenarios have **not** been synced.

### Bugs already fixed (don't reintroduce)
- Hyphenated headers gave a 422.
- Sessions got stuck because the `default` conditional never fired. Fixed with explicit mappings plus router nodes.
- The reflection guide echoed the patient's goodbye. Fixed by sending a clean transcript.
- The webhook returned 413. Fixed by mounting it before `express.json`.
- Japanese feedback came out in English. Fixed with the Japanese prefix.
- Japanese AI generation sometimes returned 0 questions. Fixed with one retry (`generateComplete` in `scenarioRoutes`).

---

## 5. Avatar movement clips (in progress, done by the user)

Everything is in `docs/avatar/`. The full instructions are in `docs/avatar/README.md`.

- **219 clips per avatar per environment.** All of them are listed in `docs/avatar/avatar_movements.csv` (columns: `label, name, region, movement, side, version, prompt`).
  - For comparison, the current Unreal set is 38 movements / 81 states. The new OT additions are 17 movements / 30 states plus 12 OT test clips.
- **The patient:**
  - A Taiwanese man, Han Chinese, about 52, wearing glasses and a light-blue polo, in a Taipei clinic.
  - The full description is in `docs/avatar/00_reference_image.md`.
  - The user generates that still image first, then every clip in **Google Flow**, using the image as both the **first and last frame**. Because every clip starts and ends on the same frame, no transition clips are needed.
- **Clip prompts:** they contain only the movement, by design (the user asked for this). Each clip is at least 10 seconds long at 25 fps, with a 2-second hold at the end position.
- **Labels:** each clip's label is also its file name and its Voxio frame label, e.g. `shoulder_flexion_left_full`, `shoulder_flexion_right_90`, `test_finkelstein_left_painful`. The idle clip is `main` (in `01_rest`).
- **Versions:** Full / Limited (`ltd`) / Limited at 90° / Limited at 120°. Tests are Painful / No pain.
- **Folders:**
  - Each folder has `prompts.md` and `prompts.csv`, and the videos are saved in the same folder.
  - Layout:
    ```
    01_rest 1 | 02_shoulder/left|right 17 each | 03_neck 16 | 04_lower_back 12
    05_hip/left|right 14 | 06_knee 6 | 07_ankle 8 | 08_foot 8 | 09_elbow 4
    10_forearm 4 | 11_wrist 8 | 12_thumb 10 | 13_fingers 4 | 14_test 12   (each side)
    ```
- **Regenerating the prompts:**
  - Run `python docs/avatar/tools/gen_moves.py` and then `python docs/avatar/tools/split_moves.py`. Both scripts have hard-coded absolute paths into `D:/vps/Virtual-Patient-Simulator/docs/avatar`.
  - `gen_moves.py` holds the `PERSON`/`REFERENCE` description, the movement table and the wording.
- **Open issue: seated clips.** Hip internal and external rotation and knee extension are written as **seated**, but the reference image is standing. The options are a second, seated reference image, or rewriting those prompts as standing.
- **Progress:**
  - The user says they have made **all the videos for neck (03) and left shoulder (02_shoulder/left)**.
  - As of 2026-11-06, **no video files were found in those folders**. They are stored elsewhere and need to be copied in, named `<label>.mp4`.
- **Still to do:**
  - Shoulder right, lower back, hip, knee, ankle, foot, elbow, forearm, wrist, thumb, fingers, tests, and `main` (rest).
- **Possible later:** a female Taiwanese avatar set. It is not requested yet.

---

## 6. Next steps (in order)

1. **Get the new Voxio account key from the user.** Put it in `.env` and never print it.
   - Check that the SDK server side (`gpu.data.voxio.in`) works with it.
2. **Wire movement clips into the flow.**
   - Change the `patient` node's output from `movement: region.movement` to a **`frame`** key. Its value must be a clip label from `avatar_movements.csv`.
   - The patient AI chooses the version (full/ltd/90/120, or painful/no pain for tests) from the scenario's limits (`animationTriggers`) and the side from the affected side.
   - Constrain the AI to the labels whose clips exist.
3. **Load the faces and clips into each flow.**
   - Upload the clips with their labels and with `main` as idle, following `vx-backend-monorepo` lipsync and `D:\vx\tempp\src\lib\voice\vpsCustoms.ts`.
   - Plumb them through `buildFaces` / `VOXIO_FACES_*`.
4. **Build the browser patient room** with the `voxioagent` SDK. It shows the video via `agentVideo` and replaces Unreal.
   - The session start, reflection, feedback and reasoning endpoints stay the same.
5. **Commit `voxio/dev`** when the user asks.
6. **Go live:** only when the user decides, run `syncVoxioFlows --apply` to update the real scenarios.

---

## 7. Open client questions

- Sign-off on the OT standard-question criteria (currently a draft).
- Case-detail fields. Proposed: the AI fills in diagnosis, differentials, red flags and the confirming exam as separate fields for the educator to check. They feed the case reveal and the red-flag alert. Recommended, but not built.
- Learning objectives: the AI writes them and the educator edits them, with a fallback chain. This already exists.
- The 15-minute session limit, and the other open OT doc questions raised during the OT docs review.

---

## 8. Other context

- I reviewed the `ci/internal-shortlisting` branch for its design system: combination (connected) buttons and inputs, colours, accents and fonts. That was analysis only; nothing was applied.
- I researched Voxio's website, docs and APIs. Section 3 is the condensed result.
