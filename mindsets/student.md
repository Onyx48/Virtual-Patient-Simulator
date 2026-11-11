# Student: how they think

Written 2026-11-08 from `research_notes/VPS stakeholder mindsets/learners.md`,
`learner_forum_voice.md` and `reports/VPS stakeholder mindsets.md`, in the format of
`mindsets/educator.md`. **[E]** = cited in those notes, **[I]** = our inference. Learner forum voice
is thin (Reddit and others were blocked), so treat the "they think" lines as hypotheses to test with
SIT students. The per-screen consequences are in `docs/STUDENT_SCREENS.md`.

# Part A — without technicalities

## Who they are

- **A PT/OT undergraduate** (SIT; later Tung Wah, Shinshu) in the weeks before the Clinical Practice
  Examination (CPE) or a placement. Anxious, time-poor, judged by a clinical educator they fear [E].
- **A junior clinician** keeping skills up between shifts: short sessions, visible gains [I].
- They use ChatGPT weekly and rarely know the rules on it [E].

## How they think

| # | They think | What it means for us | Basis |
|---|---|---|---|
| 1 | "I want to fail where nobody important is watching." | Say plainly it is practice and private: only you and your educator. No leaderboards, no class ranks. | [E] placement stress; [I] face |
| 2 | "What do I do now?" Little time, many tasks. | One obvious next step ("Up next: Start"), one click, about 15 minutes. | [E] workload; [I] |
| 3 | "Will I pass the CPE / placement?" | Show progress toward readiness, not raw totals: done, improving, what to practise next. | [E] SIT: simulation is the CPE cornerstone |
| 4 | "Did I get better?" | Every attempt shows the change from the last one (+12). A trend over time. | [I] motivation from visible gains |
| 5 | "Why did I get this score?" Opaque scores are distrusted. | Feedback and the full conversation next to the score. A way to say "this looks wrong". | [E] mixed trust in AI scoring |
| 6 | "It misheard me." Accented and Singlish speech is misrecognised more. | Show what the system heard; let them flag "it misheard me" to the educator. | [E] ASR error rates on non-native speech |
| 7 | "What is this case practising?" Theory–practice gap. | A short briefing before starting: what it practises, how long, how to get the most from it. | [E] pt-ot-st.net theory–practice gap |
| 8 | "Can I just look up the answers?" | Never send the case prompt or grading questions to the student's browser. | [E] ChatGPT use; [I] gaming model |
| 9 | "I'm nervous about the awkward questions" (bowel/bladder, mood). | A safe place to rehearse them; never punitive wording. | [I] face; continence screening |
| 10 | "Let me remember what to change next time." | A private note per attempt ("ask about night pain first"). | [I] |

## What we want them to become

From "I'll practise the night before" or "I'll just pass the checklist" to **"I do one short
session, read what to change, and try again"**, with the educator able to see the effort.

# Part B — with technicalities

- **What students may read.** Scenarios: name, description, difficulty, profession, objectives,
  testable. Never `scenarioPrompt`, `aiQuestions`, `aiInstructions`, `apiKey`, `html` (stripped
  server-side for the student role since 2026-11-08). Sessions: score, feedback, transcript,
  reflection summary; never `question_results`, `distress_flag`, `educator_note`.
- **Own sessions.** `GET /api/sessions/mine`; per scenario `GET /api/sessions/by-student/:id/:scenarioId`
  (own id only for a student since 2026-11-08).
- **Notes and flags.** `PATCH /api/sessions/:id/mine` { note, flag } → `student_note` (private) and
  `student_flag` (shown to the educator).
- **Screens.** `src/roles/student/Dashboard.jsx`, `src/components/StudentScenariosPage.jsx`,
  `src/roles/student/scenarios/{ScenrioGridStudent,StudentScenarioDetails}.jsx`.
