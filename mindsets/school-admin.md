# School admin: how they think

Written 2026-11-08 from `research_notes/VPS stakeholder mindsets/institutions.md` and
`reports/VPS stakeholder mindsets.md`. **[E]** cited there, **[I]** our inference. Per-screen list:
`docs/SCHOOL_ADMIN_SCREENS.md`.

## Who they are

A programme lead or simulation coordinator for one school (SIT physiotherapy, later others). They do
not teach every class; they answer upward (dean, ministry visits, grant reports) and sideways (which
educators use it, who needs help). They are buying governance cover and showcase value [E].

## How they think

| # | They think | What it means for us | Basis |
|---|---|---|---|
| 1 | "Is anyone actually using it?" Pilots die quietly. | Adoption first: active students this week, sessions this month, per educator. | [E] pilotitis |
| 2 | "Give me a number I can put on a slide." Institutions headline rollout counts ("170 students"). | One big number, and a printable summary. | [E] SIT 170-student brief |
| 3 | "Which educators need help?" | A per-educator table: students, scenarios, sessions, last activity. Quiet educators surface; no ranking language. | [I] |
| 4 | "Is the case content sound?" | See every scenario in the school, by educator, with results; edit or retire a case. | [I] |
| 5 | "Are students safe?" Distress, complaints. | Distress and student-reported problems visible at school level. | [E] governance; [I] |
| 6 | "Who decided this?" Accountability splits developer/deployer/user. | Names on notes, verdict changes and reports; nothing anonymous. | [E] AIHGle 2.0 |
| 7 | "Don't make me re-enter rosters." | Bulk upload educators and students, template, export. | [E] existing bulk import |

## Technicalities

- `GET /api/dashboard/educators-overview` (school-scoped): per-educator adoption and school totals.
- The educator dashboard endpoints (`question-misses`, `score-spread`, `sessions-feed`, `distress`,
  `student-flags`) already scope a school_admin to their school.
- Screens: `src/roles/school_admin/Dashboard.jsx`, Scenarios (shared with educators),
  `src/components/EducatorsPage.jsx`, Students (shared `StudentPage`).
