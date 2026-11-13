# AI providers and ISMS scope — learner data

Answers the ISO 27001 questions from auditor support (2026-11-12). Decisions recorded 2026-11-12 by the VPS team.

Feeds IRL #2 (Statement of Applicability), #24/#25 (vendors), #27 (network diagram).

---

## 1. ISMS scope

| Component                                                                 | In scope?       | Note                                                                                       |
| ------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| **VPS web dashboard** (`dev.dashboard.proroleplay.com`)                   | ✅ In scope     | Our code, this repository (`src/`)                                                         |
| **VPS backend API + conversation engine** (`dev.backend.proroleplay.com`) | ✅ In scope     | Our code (`backend/`): accounts, scenarios, patient AI, grading, reasoning tutor           |
| **Data in MongoDB Atlas**                                                 | ✅ In scope     | Supplier-hosted, our data                                                                  |
| **AWS hosting** (EC2, SES)                                                | ✅ In scope     | Supplier-hosted, our configuration                                                         |
| **Simulator game** (Unreal / Pixel Streaming avatar)                      | ❌ Out of scope | Not built or operated by us                                                                |
| **StreamPixel**                                                           | ❌ Out of scope | Hosts the game, which is not ours                                                          |
| **Voxio** (`*.voxio.in`)                                                  | ❌ Out of scope | Separate product, excluded entirely — [ISMS_SCOPE_EXCLUSIONS.md](ISMS_SCOPE_EXCLUSIONS.md) |
| **CaseIndex** (`caseindex.io`)                                            | ❌ Out of scope | Separate product, excluded entirely — [ISMS_SCOPE_EXCLUSIONS.md](ISMS_SCOPE_EXCLUSIONS.md) |

Scope statement:

> _The ISMS covers the Silver Wings XR Virtual Patient Simulator platform — its web dashboard and backend API (including the AI conversation engine) hosted on AWS, and their data in MongoDB Atlas. The simulator game and its streaming (StreamPixel) and the Voxio platform are outside the scope._

> Voxio and CaseIndex are excluded entirely, including their servers, domains and registrars: see [ISMS_SCOPE_EXCLUSIONS.md](ISMS_SCOPE_EXCLUSIONS.md). Account-level AWS controls stay in scope.

---

## 2. AI providers — exactly three

| #   | Provider                                                      | Receives                                                                                              | Status                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **OpenRouter** (`openrouter.ai`)                              | Every learner turn and the full transcript (patient replies, grading, reasoning tutor); scenario text | ✅ The **only** AI the backend calls (since 2026-11-12) — `backend/utils/openrouterClient.js`. Primary model `google/gemini-2.5-flash`, fallback `openai/gpt-oss-120b`, chosen inside OpenRouter. Requests set `provider.data_collection = "deny"`: only hosts that neither store nor train on prompts |
| 2   | **Speech-to-text: Runtime Speech Recognizer** (Unreal plugin) | Learner's voice → text                                                                                | **Runs locally, no cloud call.** Uses OpenAI's open **Whisper** model via whisper.cpp, inside the game build. Model confirmed as **base**                                                                                                                                                              |
| 3   | **Text-to-speech: ElevenLabs** (cloud)                        | The patient's lines (AI-generated text) → patient voice audio. **No learner voice or learner text**   | ✅ Confirmed 2026-11-12. Cloud supplier: needs vendor assessment (security certificate, data-retention / no-training settings, region)                                                                                                                                                                 |

**Removed 2026-11-12:** direct Google Gemini API, Groq. **Not used:** Soniox, Voxio, OpenAI directly, Piper/Kokoro.

**Where the speech parts run:** speech-to-text (Whisper) runs inside the game on StreamPixel's GPU, so the learner's voice reaches StreamPixel's servers but no speech-AI company. Text-to-speech is ElevenLabs in the cloud, which receives only the patient's lines. So the external AI suppliers are **OpenRouter** (learner text) and **ElevenLabs** (patient text only); Whisper is open-source software inside the game build, made into a plugin by Georgy Treshchev (Fab marketplace).

## 2b. Other suppliers (VPS supplier register)

| Supplier      | Service                                                  | Data it touches                                                 |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| AWS           | EC2 hosting, SES email, Route 53 DNS (`proroleplay.com`) | All app traffic; emails (address, OTP)                          |
| MongoDB Atlas | Database                                                 | All persistent data                                             |
| GitHub        | Source code, change control (pull requests)              | Source code                                                     |
| StreamPixel   | Streams the simulator game (game out of scope)           | Session link only (room id, language)                           |
| ElevenLabs    | Text-to-speech for the patient's voice                   | Patient lines (AI-generated); no learner data                   |
| Microsoft     | Company email / productivity; Windows Server licence     | Company communications                                          |
| SonarQube     | Code quality and security scanning                       | Source code (if SonarCloud) — scan reports are IRL #14 evidence |
| Let's Encrypt | Free HTTPS certificates (via Certbot)                    | None — issues certificates only                                 |
| Sentry        | Error tracking                                           | Errors with user id + role                                      |
| PostHog       | Product analytics                                        | Usage events with user id + role                                |
| Cloudflare    | Edge / traffic logs (planned)                            | Request metadata                                                |

Not VPS suppliers: Google (no longer called), GoDaddy (`voxio.in`), Namecheap (`caseindex.io`), CaseIndex.

## 3. Incident, bug and feature tracking

| Need                                                      | Tool                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors / incidents detected automatically                 | **Sentry** (backend + frontend, live since 2026-11-12) — add an alert rule for new issues                                                                |
| Usage and behaviour                                       | **PostHog**                                                                                                                                              |
| Edge / traffic logs                                       | **Cloudflare** logs (planned)                                                                                                                            |
| Tickets: incidents, bugs, features, with owner and status | **GitHub Issues** — labels `incident`, `bug`, `feature`; each fix PR links its issue, so incident → fix → approved change is one trail (IRL #7, #8, #30) |

---

## Open items

1. Whisper model confirmed as **base**, which is weak for Japanese, Mandarin and Hindi (published error rates about 38 %, 48 % and over 100 %). Being reviewed by the game team.
2. ElevenLabs: confirm the plan's data-retention setting (zero-retention if available) and that the patient's lines contain no learner personal data.
3. **Add OpenRouter credits** — the account returns HTTP 402 _Insufficient credits_, and since 2026-11-12 OpenRouter is the only AI path, so scenario generation, the patient and grading do not work until it is funded.
