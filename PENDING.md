# Pending

## 1. Monitoring keys (waiting on you)

PostHog and Sentry are installed and wired in, but stay switched off until the keys are added. Put them in `.env` (see `.env.example`):

| Key | Where it goes | Used for |
|---|---|---|
| `SENTRY_DSN` | backend `.env` | errors on the server |
| `VITE_SENTRY_DSN` | website build | errors in the browser |
| `POSTHOG_KEY` | backend `.env` | server events (logins) |
| `VITE_POSTHOG_KEY` | website build | page views and clicks |

Keys starting with `VITE_` are built into the website, so rebuild the website after adding them.

## 2. Where to run the load test

Run `scripts/loadTest.mjs` against a **staging** server, never the live one.

- **Why not the live site:** the test sends hundreds of requests a second. Real teachers and students on the live site would see it slow down or fail while the test runs. The script refuses production addresses unless forced.
- **Why it needs the AWS setup (TECH23) first:** the point of the test is to find how many users the real setup can carry. Right now there is one server and no automatic scaling. A test today only tells us the limit of that one server, not of the setup we will go live with. Once staging runs on the same AWS setup as production (same server size, autoscaling switched on), the results will match what users will actually experience.

What we still need:
- A staging server set up the same way as production (TECH23).
- A staging database with test accounts, not the live one.
- Agreed targets from the client: how many users at the same time, and how fast pages must load.

Example run once staging exists:

```
node scripts/loadTest.mjs --target https://<staging-api> --users 200 --duration 300 --out results.json
```

## 3. Load-testing the voice and AI part (separate job)

The load test above covers logging in and the website screens. It does **not** start voice sessions with the virtual patient, on purpose.

A voice session goes through three outside services:
- **Our backend** runs the patient conversation by calling Groq or Gemini directly (Voxio was removed, see `docs/VOXIO_REPLACEMENT_PLAN.md`).
- **Soniox** turns speech into text.
- **Gemini / Groq** write the scenarios, the patient answers and the feedback. The free Gemini key allows only 20 requests a day.

These are the real limit, not our server:
- **Each has a cap** on how many sessions or requests it allows at once, set by our plan with them. If 100 students start sessions together and the cap is 20, the other 80 fail, however strong our server is.
- **Each session costs money.** Testing with 100 fake students running 10-minute sessions means paying for all of them.

What we have to do:
1. Ask Soniox, Groq and Google (Gemini) what our current limits are, and what higher limits cost.
2. Run a small, planned test: for example 10, then 25, then 50 sessions at once, and note when replies get slow or sessions fail.
3. Record the cost of that test, so we can estimate the cost per student per month.
4. Decide what the app shows when a limit is hit (for example "please wait, the simulator is busy") instead of a broken session.
