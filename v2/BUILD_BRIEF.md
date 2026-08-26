# Build Brief — read this first

**Audience: a Claude Code agent picking up this build.** You are implementing
the app specified in `PRODUCT_MAP.md`. Read that file next; it holds the schema,
the endpoint table, the room model, and the recording flow. This file tells you
the constraints, the conventions to follow, and the traps.

---

## Mission

A live-avatar training simulator, rebuilt from scratch under `v2/`. Three roles:
`super_admin`, `admin`, `user`. An admin authors scenarios (prompts the avatar
follows) via Claude on Bedrock, manages an organisation's candidates and users,
and reviews activity including session recordings. A user gets mailed
credentials and runs one time-limited avatar session at a time.

Do **not** modify anything outside `v2/`. The repository root holds a live,
deployed app (a four-role school/educator product) that this rebuild will
eventually replace. It is still in production. Leave it alone.

---

## Non-negotiables

1. **All LLM calls go through Amazon Bedrock. The model is Claude Sonnet 4.6.**
   The Bedrock model id is `anthropic.claude-sonnet-4-6`. The `anthropic.`
   prefix is required. There is **no date suffix** — do not write
   `anthropic.claude-sonnet-4-6-20251114` or any dated variant you may recall.
   Use the Mantle client from `@anthropic-ai/bedrock-sdk`
   (`new AnthropicBedrockMantle({ awsRegion })`), which exposes the standard
   Messages API surface. Do not hand-roll `InvokeModel` payloads, and do not
   substitute another provider or model.
2. **No secrets in the repo.** AWS credentials, `JWT_SECRET`, `ROOM_TOKEN_SECRET`
   and the Mongo URI all come from the environment. `v2/backend/.env.example`
   documents the names; `.env` is gitignored. If credentials are pasted into
   chat, do not write them to a file.
3. **Keep it simple.** One Express backend, one Mongo database, one Vite
   frontend. No microservices, no message queue, no GraphQL, no Redis, no SSR.
   If you find yourself adding a fourth moving part, stop.
4. **Plain JS + ESM everywhere.** No TypeScript. Backend is `"type": "module"`
   with `.js` extensions on every relative import — this is how the existing
   backend works and it is a hard requirement of Node ESM resolution.
5. **Every org-scoped query filters on `organisationId`.** See the trap section.

---

## Conventions carried over from the existing codebase

These patterns are proven in production here. Reuse their shape rather than
inventing your own.

**Password hashing lives in a Mongoose pre-save hook**, not in route handlers.
From `backend/models/userModel.js`:

```js
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};
```

Keep the hook. Rename the field to `passwordHash` and add `select: false` so it
is never returned by accident — the existing code has to remember
`.select("-password")` at every call site, which is exactly the kind of thing
that gets forgotten once.

**Auth middleware verifies the bearer token and attaches the full user.**
From `backend/middleware/authMiddleware.js`:

```js
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = await User.findById(decoded.id).select("-password").populate("schoolId");
if (!req.user) return res.status(401).json({ message: "Not authorized, user not found" });
```

Keep this shape: verify, load, 401 on a valid signature for a deleted user.
Populate `organisationId` instead of `schoolId`. Also check
`req.user.status === "active"` — the existing code does not, so a disabled user
keeps working until their token expires.

**Role checks are a middleware factory.** The existing `authorize(...roles)` is
the right primitive:

```js
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Role '${req.user?.role}' not authorized` });
  }
  next();
};
```

Use `requireRole("admin")` per route. Do **not** rebuild the existing
`rolePermissions.js` action-matrix plus `checkAccess` scope-computing pair — see
the traps section for why.

**SES for mail, one module, one exported function per template.** Follow
`backend/utils/emailService.js`: a module-level `SESClient` built from
`AWS_REGION` and the credential env vars, then
`sendWelcomeEmail({ toEmail, name, password })` sending `SendEmailCommand` with
inline HTML. `EMAIL_FROM` must be a verified SES identity. Wrap sends in
try/catch and **never let a failed email roll back a created user** — return the
generated password in the API response when the mail send fails, so the admin
can pass it on manually.

**Express bootstrap.** Follow `backend/index.js`: `cors` with an explicit origin
allowlist from env, `express.json()`, routers mounted under `/api/<resource>`, a
catch-all 404, then a global error handler last. Delete the existing
`/debug/env` route idea — it leaks configuration.

**Frontend API base URL is baked in at build time.** From `src/main.jsx`:

```js
axios.defaults.baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://<prod-backend>" : "http://localhost:5001");
```

Keep that fallback pattern. For `v2`, prefer a thin `fetch` wrapper over axios —
one file, attaches the bearer token, throws on non-2xx — since there is no need
for interceptors.

---

## Traps — these are real bugs in the current codebase

Do not reproduce them.

**Split-brain access control.** The existing app expresses authorisation in
three places that do not derive from each other: a permission matrix
(`rolePermissions.js`), `allowedRoles` on each frontend route, and a `roles`
array on each sidebar item. Any change requires editing all three, and they have
drifted. **In `v2`, the backend route definition is the single source of truth.**
The frontend may hide what a role cannot use, but it must never be the thing
that enforces it.

**`checkAccess` computes a scope it does not apply.** The existing middleware
sets `req.scope` and each handler is *supposed* to merge it into its Mongo
query. Several never do, so those endpoints leak across tenants. **In `v2`, do
not build a scope object.** Write the filter directly in every handler:

```js
const filter = req.user.role === "super_admin" ? {} : { organisationId: req.user.organisationId };
```

A missing `organisationId` in a query is a cross-tenant data leak. Treat it as
the highest-severity class of bug in this codebase.

**Unauthenticated privilege escalation.** `POST /api/auth/register` in the
existing app is public and reads a client-supplied `creatorRole` from the body,
so anyone can create a superadmin. **`v2` has no public registration at all.**
Accounts are only ever created by a role above: super admin creates admins,
admin creates users. Never trust a role from a request body.

**Token key mismatch.** The existing `AuthContext` stores the JWT under
`authToken`, but `TranscriptViewerModal.jsx` reads `localStorage.getItem("token")`
and sends `Bearer undefined`. Define the storage key **once**, export it as a
constant, and have exactly one module touch `localStorage`.

**Stored user trusted on reload.** The existing `AuthContext` restores
`currentUser` from `localStorage` without revalidating, so an expired session
surfaces as scattered 401s instead of a redirect. **In `v2`, call `GET /auth/me`
on mount** and clear state on 401.

**Duplicate entrypoints and dead trees.** The existing repo has two
byte-identical server entrypoints that silently drift, and two parallel
component trees where only one is routed. Keep exactly one of each.

---

## Definition of done, per step

Follow the build order in `PRODUCT_MAP.md` §1. A step is done when:

1. **Schema** — all six models load, indexes declared, `npm run seed` creates the
   first super admin from env vars.
2. **Auth** — login returns a JWT; `GET /auth/me` round-trips; a disabled user is
   refused; a wrong password is indistinguishable in timing from an unknown email.
3. **Organisations** — creating an org creates its admin and mails a generated
   password; a second org with the same name is rejected.
4. **Candidates** — CRUD works and an admin from org A gets 404, not 403, for a
   candidate in org B (do not confirm existence across tenants).
5. **Users** — admin creates a `user`; the role cannot be overridden from the body.
6. **Scenarios** — a brief produces a validated draft from Sonnet 4.6; malformed
   model output triggers exactly one repair attempt then a 502; nothing is
   persisted until the admin confirms.
7. **Rooms** — a session cannot start without credits, with an expired
   subscription, or while another is active; expiry is enforced server-side even
   if the client never calls `end`.
8. **Recording** — bytes go browser→S3 directly; playback URLs are presigned,
   short-lived, and admin-only.
9. **Dashboards** — every aggregate is org-scoped.
10. **Home page** — renders without auth, no console errors, responsive.

---

## Things left to your judgement

- The avatar runtime is external. Treat it as a URL that accepts a room token
  (`AVATAR_RUNTIME_URL`); the existing app does the same thing with a JWE
  handoff to a service called VAssist. Do not try to implement the avatar.
- MetaHuman imagery for the home page: use remote placeholder URLs and leave a
  comment marking them for replacement. Do not commit binary assets.
- Scoring: a session accepts a `score` and `feedback` on `end`. Whether the
  score is computed by the avatar runtime or by a second Bedrock call against
  the scenario's rubric is not yet decided — build the field, leave the
  computation behind one function so it can be swapped.

If a genuine ambiguity blocks you, state your assumption in a comment and keep
building. Do not stop and wait.
