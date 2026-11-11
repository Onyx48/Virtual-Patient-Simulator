# Student screens: what to add, remove, change

Started 2026-11-08. Rows tie to `mindsets/student.md` (S1–S10). **[x]** done · **[ ]** open ·
**[b]** needs a backend change (done alongside where marked [x]).

## Safety first (S8)

- [x] Students no longer receive `scenarioPrompt`, `aiQuestions`, `aiInstructions`, `apiKey`, `html` from `/api/scenarios` and `/api/scenarios/:id` (b).
- [x] `/api/sessions/by-student/:studentId/:scenarioId`: a student can only read their own; an educator only their own students (b).
- [x] All attempts load on the scenario page (was capped at 5) (b).

## Dashboard (S1–S4)

- [x] Up next with one-click Start; "only you and your educator see results".
- [x] This week: sessions practised in the last 7 days, and how long since the last one.
- [x] Scores over time (bklit line), every attempt.
- [x] Recent attempts with the change from the previous try (+12 / −5).
- [x] Readiness by area: share covered per grading criterion on the latest attempt of each scenario; only criterion names and percentages reach the student (b: `GET /api/sessions/mine/readiness`).
- [x] Gentle in-app nudge in Up next after 7 quiet days.

## Scenarios (S2, S4)

- [x] Card shows attempts and "last practised 3 days ago".
- [ ] Card shows the change on the last attempt (the dashboard's Recent attempts shows it; the card does not yet).
- [x] "Recently practised" sort.

## Scenario page (S4–S7, S10)

- [x] "Before you start": what it practises (learning objectives), about 15 minutes, how to get the most out of it (quiet room, speak normally, open questions first, it is practice).
- [x] Change from the previous attempt next to each score.
- [x] Copy feedback.
- [x] Private note per attempt ("what I'll do differently"), saved on blur (b).
- [x] "Something wrong?" flag on an attempt: misheard me / feedback seems wrong / technical problem / other, with a comment; goes to the educator (b).
- [x] Educator sees flags in Transcripts and in Needs you.
- [ ] Practise again from a specific weakness ("focus on red flags this time"). *Blocked: Voxio's start_session takes no per-session instructions; needs a session variable from Voxio or a change to every scenario flow.*
- [x] Save an attempt as PDF (print view: score, feedback, my note, conversation).

## Everywhere

- [x] Student header search finds own scenarios.
- [x] Microphone check before every Start (live level meter, "don't ask again").
