# Avatar Simulator — Product Map & Technical Specification

Rebuilt from scratch. Three roles, one backend, one database, one frontend.
All LLM calls go through **Amazon Bedrock** using **Claude Sonnet 4.6**
(`anthropic.claude-sonnet-4-6` — the `anthropic.` prefix is required and there
is no date suffix).

---

## 1. Build order

Each step depends only on the ones above it.

| # | Step | Depends on | Deliverable |
|---|------|-----------|-------------|
| 1 | Database config + schema | — | Mongo connection, six models |
| 2 | Auth + RBAC | 1 | Login, JWT, `requireAuth`, `requireRole` |
| 3 | Super Admin: organisations + admins | 2 | Create org, create its admin, mail credentials |
| 4 | Admin: candidates CRUD | 2, 3 | Candidate list scoped to org |
| 5 | Admin: users (session credentials) | 2, 3 | Create user, generated password, mail |
| 6 | Bedrock scenario authoring | 2, 3 | Brief → Sonnet 4.6 → validated scenario → saved |
| 7 | Rooms (time-limited sessions) | 5, 6 | Start/join/heartbeat/end, credit debit |
| 8 | Recording | 7 | Presigned upload, finalize, presigned playback |
| 9 | Dashboards | 3–8 | Activity for Admin and Super Admin |
| 10 | Home page | — | Marketing landing (parallel with 1–9) |

Steps 1–2 are the hard prerequisites. Step 10 touches nothing else and can be
built at any time.

---

## 2. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 20 ESM | One language across the stack; native `fetch`, top-level await |
| API | Express 4 | Smallest thing that does routing + middleware; no framework to learn |
| Database | MongoDB + Mongoose | Scenarios and transcripts are nested documents; schema-per-model is enough structure |
| Auth | `jsonwebtoken` + `bcryptjs` | Stateless bearer tokens; no session store to operate |
| LLM | `@anthropic-ai/bedrock-sdk` (Mantle client) | Gives the Messages API surface on Bedrock; avoids hand-rolling InvokeModel payloads |
| Object storage | AWS S3 via presigned URLs | Recording bytes never pass through the API server |
| Mail | AWS SES | Already an AWS deployment; one less vendor |
| Frontend | React 19 + Vite | Fast dev server, no SSR needed for a dashboard app |
| Routing | React Router 7 | Standard |
| Styling | Tailwind 3 | No design system to maintain |
| State | React Context + `fetch` wrapper | Three roles and a dozen screens do not need Redux |

Deliberately **not** used: microservices, message queues, GraphQL, Redis,
Docker Compose orchestration, server-side rendering.

---

## 3. Database configuration

Single Mongo database, single connection pool, opened once at boot. The process
exits non-zero if the connection fails — a running API with no database is worse
than a dead one.

```
MONGODB_URI=mongodb://127.0.0.1:27017/avatar_sim
maxPoolSize=10
serverSelectionTimeoutMS=8000
autoIndex=true in development, false in production (indexes built by migration)
```

Indexes are declared on the models. In production, build them once with
`npm run ensure-indexes` rather than on every boot.

---

## 4. Schema

Six collections. `organisationId` is the tenancy boundary on every
org-scoped document.

### `organisations`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | required, unique, trimmed |
| `slug` | String | required, unique, lowercase, derived from name |
| `status` | String | `active` \| `suspended`, default `active` |
| `sessionCreditsMinutes` | Number | pool of avatar minutes, default 0, min 0 |
| `defaultSessionLimitMinutes` | Number | default per-user cap, default 20 |
| `subscriptionExpiresAt` | Date | nullable; null = no expiry |
| `createdBy` | ObjectId → `users` | the super admin who created it |
| `createdAt` / `updatedAt` | Date | timestamps |

Virtual: `isSubscriptionActive` — `status === 'active'` and expiry is null or future.

### `users`

Every login lives here, all three roles.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | required |
| `email` | String | required, unique, lowercase |
| `passwordHash` | String | required, `select: false` |
| `role` | String | `super_admin` \| `admin` \| `user` |
| `organisationId` | ObjectId → `organisations` | required unless `super_admin` |
| `status` | String | `active` \| `disabled`, default `active` |
| `sessionLimitMinutes` | Number | per-session cap; falls back to org default |
| `mustChangePassword` | Boolean | true for mailed credentials |
| `lastLoginAt` | Date | nullable |
| `createdBy` | ObjectId → `users` | nullable |

Indexes: unique `email`; compound `{ organisationId, role }`.
Validation: `organisationId` required for `admin` and `user`, forbidden for `super_admin`.

### `candidates`

Organisation directory. Not a login — a person a session can be *about*.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `organisationId` | ObjectId → `organisations` | required |
| `name` | String | required |
| `email` | String | required, lowercase |
| `designation` | String | required |
| `expertise` | [String] | tags, default `[]` |
| `notes` | String | optional |
| `createdBy` | ObjectId → `users` | |

Index: unique compound `{ organisationId, email }` — the same email may exist in two orgs.

### `scenarios`

The prompt the LLM follows during a session. Authored through Bedrock.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `organisationId` | ObjectId → `organisations` | required |
| `title` | String | required |
| `summary` | String | one-line description |
| `brief` | String | the admin's raw input |
| `systemPrompt` | String | required — what the avatar is told |
| `openingLine` | String | avatar's first utterance |
| `objectives` | [String] | what the user should achieve |
| `rubric` | [{ `criterion`, `weight`, `description` }] | scoring dimensions; weights sum to 100 |
| `difficulty` | String | `easy` \| `medium` \| `hard` |
| `status` | String | `draft` \| `published` \| `archived` |
| `generation` | { `model`, `bedrockRegion`, `inputTokens`, `outputTokens`, `generatedAt`, `attempts` } | audit of the Bedrock call |
| `createdBy` | ObjectId → `users` | |

Index: compound `{ organisationId, status }`.
A scenario is only saved after Bedrock returns a payload that validates.

### `sessions`

One row per avatar run. Also the room record.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | doubles as the room name |
| `organisationId` | ObjectId → `organisations` | required |
| `userId` | ObjectId → `users` | required — who ran it |
| `scenarioId` | ObjectId → `scenarios` | required |
| `candidateId` | ObjectId → `candidates` | optional subject |
| `status` | String | `pending` \| `active` \| `completed` \| `expired` \| `aborted` |
| `limitMinutes` | Number | the cap applied at start |
| `startedAt` / `endedAt` | Date | |
| `expiresAt` | Date | `startedAt + limitMinutes` — the hard wall |
| `lastHeartbeatAt` | Date | drives expiry sweeps |
| `durationSeconds` | Number | computed at end |
| `creditsDebited` | Number | minutes actually taken from the org pool |
| `transcript` | [{ `role`, `content`, `at` }] | `user` \| `avatar` |
| `score` | Number | nullable, 0–100 |
| `feedback` | String | nullable |
| `recordingId` | ObjectId → `recordings` | nullable |

Indexes: `{ organisationId, createdAt: -1 }`, `{ userId, createdAt: -1 }`,
`{ status, expiresAt }` for the sweeper.

### `recordings`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `sessionId` | ObjectId → `sessions` | required, unique |
| `organisationId` | ObjectId → `organisations` | required — enables access checks without a join |
| `storageKey` | String | S3 object key |
| `bucket` | String | |
| `contentType` | String | default `video/webm` |
| `sizeBytes` | Number | set on finalize |
| `durationSeconds` | Number | |
| `status` | String | `pending` \| `uploaded` \| `failed` |
| `uploadedAt` | Date | |

Key layout: `recordings/{organisationId}/{sessionId}/{timestamp}.webm`

### Relationships

```
organisations 1──n users          (users.organisationId)
organisations 1──n candidates
organisations 1──n scenarios
organisations 1──n sessions
users         1──n sessions       (sessions.userId)
scenarios     1──n sessions
candidates    1──n sessions       (optional)
sessions      1──1 recordings
```

---

## 5. API

Base path `/api`. All non-public routes take `Authorization: Bearer <jwt>`.
Roles below are the *only* roles accepted; everything is additionally scoped to
the caller's organisation unless the caller is `super_admin`.

### Auth — `/api/auth`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| POST | `/login` | public | `{ email, password }` | `{ token, user }` |
| GET | `/me` | any | — | `{ user }` (org populated) |
| POST | `/change-password` | any | `{ currentPassword, newPassword }` | `{ ok: true }` |
| POST | `/logout` | any | — | `{ ok: true }` (client discards token) |

### Organisations — `/api/organisations`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/` | super_admin | — | `[organisation]` with user counts |
| POST | `/` | super_admin | `{ name, sessionCreditsMinutes, defaultSessionLimitMinutes, subscriptionExpiresAt, admin: { name, email } }` | `{ organisation, admin }` — mails generated password |
| GET | `/:id` | super_admin, admin (own) | — | `{ organisation }` |
| PATCH | `/:id` | super_admin | any of the above except `admin` | `{ organisation }` |
| POST | `/:id/credits` | super_admin | `{ deltaMinutes }` | `{ organisation }` |
| DELETE | `/:id` | super_admin | — | `{ ok: true }` — suspends, does not hard-delete |

### Users — `/api/users`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/` | admin, super_admin | `?role=&q=` | `[user]` |
| POST | `/` | admin | `{ name, email, sessionLimitMinutes? }` | `{ user }` — creates role `user`, mails generated password |
| PATCH | `/:id` | admin | `{ name?, sessionLimitMinutes?, status? }` | `{ user }` |
| POST | `/:id/reset-password` | admin | — | `{ ok: true }` — mails a new password |
| DELETE | `/:id` | admin | — | `{ ok: true }` — sets `status: disabled` |

### Candidates — `/api/candidates`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/` | admin | `?q=` | `[candidate]` |
| POST | `/` | admin | `{ name, email, designation, expertise[], notes? }` | `{ candidate }` |
| PATCH | `/:id` | admin | partial | `{ candidate }` |
| DELETE | `/:id` | admin | — | `{ ok: true }` — hard delete |

### Scenarios — `/api/scenarios`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/` | admin, user | `?status=` | `[scenario]` — users see `published` only |
| POST | `/generate` | admin | `{ brief, difficulty? }` | `{ draft }` — **calls Bedrock, does not save** |
| POST | `/` | admin | the validated draft | `{ scenario }` — persists |
| GET | `/:id` | admin, user | — | `{ scenario }` |
| PATCH | `/:id` | admin | `{ status }` or field edits | `{ scenario }` |
| DELETE | `/:id` | admin | — | `{ ok: true }` — archives |

`POST /generate` is separate from `POST /` on purpose: the admin sees what the
model produced and confirms before anything is stored.

### Sessions — `/api/sessions`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| POST | `/start` | user | `{ scenarioId, candidateId? }` | `{ session, room: { name, token, url, expiresAt } }` |
| POST | `/:id/heartbeat` | user (own) | — | `{ status, secondsRemaining }` |
| POST | `/:id/turn` | user (own) | `{ role, content }` | `{ ok: true }` — appends to transcript |
| POST | `/:id/end` | user (own) | `{ score?, feedback? }` | `{ session }` — debits credits |
| GET | `/mine` | user | — | `[session]` |
| GET | `/` | admin, super_admin | `?userId=&scenarioId=&status=` | `[session]` |
| GET | `/:id` | admin, user (own) | — | `{ session }` with transcript |

### Recordings — `/api/recordings`

| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| POST | `/upload-url` | user (own session) | `{ sessionId, contentType }` | `{ recordingId, uploadUrl, storageKey }` |
| POST | `/:id/finalize` | user | `{ sizeBytes, durationSeconds }` | `{ recording }` |
| GET | `/:id/playback-url` | admin | — | `{ url, expiresIn }` — presigned GET, 5 min |

### Dashboard — `/api/dashboard`

| Method | Path | Roles | Returns |
|---|---|---|---|
| GET | `/admin` | admin | totals, minutes used, recent sessions, per-user activity |
| GET | `/super-admin` | super_admin | org count, org table with usage, platform totals |

---

## 6. Room model

A "room" is a time-boxed avatar session. There is no separate room table —
`sessions` *is* the room, and `_id` is the room name.

**Create.** `POST /api/sessions/start`. The backend, in order:

1. Rejects the call unless the caller's role is `user`.
2. Loads the organisation and refuses if `status !== 'active'` or the
   subscription has expired.
3. Resolves the cap: `user.sessionLimitMinutes ?? org.defaultSessionLimitMinutes`.
4. Refuses if `org.sessionCreditsMinutes < cap` — you cannot start a session you
   cannot afford to finish.
5. Refuses if the user already has an `active`, unexpired session (one room per user).
6. Loads the scenario, requires `status: 'published'` and a matching org.
7. Creates the session with `status: 'active'`, `startedAt = now`,
   `expiresAt = now + cap`.
8. Mints a **room token** — a short-lived JWT signed with `ROOM_TOKEN_SECRET`,
   carrying `sessionId`, `userId`, `organisationId`, `scenarioId`, the system
   prompt hash, and `exp = expiresAt`. Separate secret from the login JWT so a
   leaked room token cannot authenticate an API call.
9. Returns the token plus the avatar runtime URL.

**Join.** The frontend loads the avatar runtime in an iframe with the room token.
The runtime validates the token and enforces `exp` itself. The token is the only
credential passed to the runtime — the user's login JWT never leaves the app.

**Time limit — enforced in three independent places**, because any one of them
can be bypassed:

- The room token's `exp`. The runtime stops accepting the token.
- The client countdown, from `expiresAt`. Cosmetic, plus an auto-`end` call.
- The server. Every `heartbeat`, `turn`, and `end` call checks
  `now > expiresAt`; if so, the session is flipped to `expired` and the request
  is refused. A user who closes the tab is caught by the sweeper.

**Tear down.** Three paths converge on the same finalizer:

- **Normal** — `POST /:id/end`. Sets `endedAt`, computes `durationSeconds`,
  debits `ceil(duration / 60)` minutes from the org pool, stores score and
  feedback, marks `completed`.
- **Expiry** — the client's auto-end, or the sweeper.
- **Sweeper** — an interval (default 60 s) that finds sessions where
  `status: 'active'` and `expiresAt < now`, marks them `expired`, and debits the
  minutes actually consumed up to the last heartbeat. Idempotent: it only ever
  touches rows still marked `active`.

Credits are debited on **end**, not on start, so an aborted session costs only
what it used. The affordability check at start is what prevents an
overdraft.

---

## 7. Recording

Bytes never pass through the API server.

1. **Reserve.** The client calls `POST /api/recordings/upload-url` with its
   session id. The backend verifies the session belongs to the caller and is
   `active`, creates a `recordings` row with `status: 'pending'` and a key of
   `recordings/{orgId}/{sessionId}/{timestamp}.webm`, and returns a presigned
   S3 `PUT` URL valid for 15 minutes.
2. **Upload.** The browser `PUT`s the media blob straight to S3.
3. **Finalize.** `POST /api/recordings/:id/finalize` with the byte size and
   duration. The row flips to `uploaded`, `uploadedAt` is stamped, and the
   session's `recordingId` is set.
4. **Retrieve.** An Admin calls `GET /api/recordings/:id/playback-url`. The
   backend checks the recording's `organisationId` matches the admin's, then
   returns a presigned `GET` valid for 5 minutes. The bucket stays private with
   all public access blocked; no recording is ever served from a durable URL.

Association is by `sessionId` on the recording *and* `recordingId` on the
session — the redundancy means an admin listing sessions never needs a second
query to know whether a recording exists.

If the browser dies mid-upload the row stays `pending` and is swept to `failed`
after 24 hours. A pending recording never blocks a session from completing.

---

## 8. Product map

### Roles and screens

| Role | Screens |
|------|---------|
| **Public** | Home (hero, how it works, features, pricing, CTA) · Login |
| **User** | My sessions · Scenario picker · Live session room · Session result |
| **Admin** | Dashboard (activity across users) · Scenarios (list, generate, review, publish) · Candidates (CRUD) · Users (create, reset, disable) · Sessions (list, transcript, recording playback) |
| **Super Admin** | Dashboard (platform totals) · Organisations (create with admin, credits, subscription, suspend) |

### Data flow

```
                    ┌──────────────┐
                    │   Browser    │
                    │ React + Vite │
                    └──────┬───────┘
                           │ JSON over HTTPS, Bearer JWT
                           ▼
                    ┌──────────────┐
                    │   Express    │
                    │  requireAuth │
                    │  requireRole │
                    │  org scoping │
                    └──┬────┬───┬──┘
             ┌─────────┘    │   └──────────┐
             ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │  MongoDB   │ │  Bedrock   │ │     S3     │
      │ 6 models   │ │ Sonnet 4.6 │ │ recordings │
      └────────────┘ └────────────┘ └────────────┘
                                          ▲
                      presigned PUT/GET   │
                    ┌─────────────────────┘
                    │
             ┌──────┴───────┐        ┌──────────────┐
             │   Browser    │───────▶│ Avatar       │
             │  (media)     │  room  │ runtime      │
             └──────────────┘  token └──────────────┘
                                          ▲
                                          │ SES
                                    ┌─────┴──────┐
                                    │ credential │
                                    │   emails   │
                                    └────────────┘
```

Three flows worth tracing:

**Scenario authoring.** Admin types a brief → `POST /scenarios/generate` →
Express builds a system prompt and calls Sonnet 4.6 on Bedrock → the reply is
parsed and validated (title, system prompt, objectives, rubric weights summing
to 100) → on failure one repair attempt, then a 502 → the draft is returned to
the admin, unsaved → admin confirms → `POST /scenarios` writes it to Mongo.

**Running a session.** User picks a published scenario → `POST /sessions/start`
checks org status, subscription, credits, and the one-room-per-user rule, writes
the session, mints a room token → browser opens the avatar runtime with that
token → turns are posted to the transcript → media is uploaded straight to S3 →
`POST /sessions/end` debits credits and stores the score.

**Review.** Admin opens the dashboard → aggregate over `sessions` scoped to the
org → drills into one session → reads the transcript from Mongo and requests a
presigned playback URL for the recording.
