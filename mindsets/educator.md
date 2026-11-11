# Educator: how they think

Written 2026-11-08 from `research_notes/VPS stakeholder mindsets/educators.md` and
`reports/VPS stakeholder mindsets.md`, in the format of ci/internal-shortlisting's `mindsets/hr.md`.
Most of it is literature and inference, not interviews with our own users. **[E]** marks a claim
backed by a cited source, **[I]** marks our inference. The per-screen consequences are in
`docs/EDUCATOR_SCREENS.md`.

# Part A — without technicalities

## Who they are

- **A PT/OT lecturer or clinical supervisor** at SIT (and later Tung Wah College, Shinshu, NUH).
  Teaches, marks, supervises placements, writes cases. Time-poor, often between classes.
- **They own a cohort, not a student.** 20 to 80 students in groups ("MSK Cohort 2026 A"), with a
  placement or the Clinical Practice Examination (CPE) coming up.
- **They already have SP actors, peers playing patients, or their own chatbot.** We replace effort,
  not a gap. Free ChatGPT is the substitute they compare us against [E].

## How they think

| # | They think | What it means for us | Basis |
|---|---|---|---|
| 1 | "SP OSCEs eat my week": writing cases, training actors, scheduling. | Making a case must take minutes. Brief → AI → tweak. Never a blank form. | [E] Elevate Health; BMC Med Educ 2024 |
| 2 | "Markers disagree with each other." Staff variance is as big as student variance. | Our value is *consistent* marking. Show the same rubric for everyone, with evidence per item. | [E] BMC Med Educ 2024 |
| 3 | "AI can help, but I'm the judge." Adjunct with oversight, formative, not high-stakes. | Label scores formative. Let them override a score and add a note; log it. Never present an AI score as final. | [E] Frontiers 2025; JMIR; Juntendo |
| 4 | "Is that score right?" They trust what they can check. | Every score links to the transcript line that earned or lost it (evidence). | [E] scoping review; ACL "expert-auditable" |
| 5 | "Empathy and tone don't show in text." | Flag communication items as "needs your judgement" rather than scoring them confidently. | [E] Juntendo; 8 of 45 categories below κ 0.6 |
| 6 | "Show me the pattern, not the leaderboard." Teachers value pattern-spotting; Asian feedback norms are group-based. | Cohort-level views first ("62% never asked about red flags"); individual ranking last and private. | [E] UVA dissertation; Soemantri review |
| 7 | "Who hasn't started?" Chasing students is half the admin. | A "needs you" list: never logged in, assigned but not started, stuck low. One-click reminder and copyable email lists. | [I] from OSCE logistics + HR analogue |
| 8 | "My students will game it." Keyword stuffing, shared answers, ChatGPT on a second screen. | Show question quality signals (open vs closed, order), not just coverage; make transcripts easy to skim for odd patterns. | [I] gaming model in the report |
| 9 | "Did the AI mishear them?" Accented speech, Singlish. | Transcript visible to the educator, with a way to note "ASR error" before the score stands. | [E] ASR bias studies |
| 10 | "I need something for the programme lead." Showcase value drives adoption. | One number large on the dashboard and a downloadable/printable summary. | [E] SIT 170-student brief; [I] |
| 11 | "Is this safe for my students?" Distress, privacy, face. | Distress flags surface to the educator first; student progress is never public to peers. | [E] reflection data; PDPC |
| 12 | "I don't want to re-enter what I have." Rosters live in Excel. | Bulk upload, template, export CSV of any list, copy emails. | [E] bulk upload exists; [I] |

## The one page they come to happily

**Students.** It answers "who needs me?" That is where reminders, copy-email, filters by
"not started" and the transcript belong. Test any change there by asking: does it help them act on
a student in one click, or does it make them read more?

## How they behave

- They open the app between classes, for two minutes, to check who has done the practice.
- They read one or two transcripts closely (the weak student, the surprising score), not all of them.
- They share things outside the app: email the cohort, paste a list into a chat, show the lead a chart.
- They make a case once and reuse it across cohorts; they tweak it after seeing students struggle.

## What we want them to become

From "let me read every transcript" or "I'll check at the end of term" to **"Who needs me today,
and what did the cohort miss?"**, then nudge the student or fix the case.

# Part B — with technicalities

- **Roster and stats.** `GET /api/students` (`backend/routes/studentRoutes.js`): invite status,
  sessions, best/avg score, assigned count, and since 2026-11-08 `lastSessionAt`.
- **Reminders.** `POST /api/users/:id/resend-invite` emails a *new password*, so it is a login fix, not
  a nudge. A real "remind to practise" email needs a new endpoint; until then reminders are `mailto:`.
- **Per-question grading.** `session.question_results` (`observed`, `evidence`, `criterion`); cohort
  aggregation does not exist server-side yet.
- **Reflection and distress.** `session.reflection.distress_flag`.
- **Screens.** `src/roles/educator/Dashboard.jsx`, `src/roles/educator/scenarios/index.jsx`,
  `src/components/shared/{StudentPage,NewScenarioPage,AssignScenariosModal}.jsx`,
  `src/components/ui/TranscriptViewerModal.jsx`, `src/components/settings/SettingsPage.jsx`.
