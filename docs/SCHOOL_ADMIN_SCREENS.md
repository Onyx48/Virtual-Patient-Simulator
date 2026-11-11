# School admin screens

Started 2026-11-08. Rows tie to `mindsets/school-admin.md` (A1–A7). **[x]** done · **[ ]** open.

## Dashboard
- [x] Adoption first: active students this week, sessions in 30 days, educators using it, scenarios (A1, A2).
- [x] Educators table: students, scenarios (live), sessions in 30 days, last session (A3).
- [x] Added each month (students / educators / scenarios), bklit bars.
- [x] Distress and student-reported problems at school level (A5).
- [x] What the cohort misses, recent sessions, score spread, with period and group filters (shared with educators).
- [x] Print summary (A2).
- [ ] Downloadable report with the period's numbers and a short narrative for a dean.

## Scenarios (shared page)
- [x] Every scenario in the school, "by" educator, educator filter (A4).
- [x] Edit, publish, archive, delete; no New scenario, Duplicate or Assign (admins moderate, rolePermissions.js).
- [x] Insights per scenario.

## Educators
- [x] Toolbar, sortable table with adoption columns, "quiet" marker after 30 days without sessions (A3).
- [x] Copy email, email, edit, delete; template, bulk upload, export CSV (A7).
- [x] Department list includes Physiotherapy and Occupational Therapy (additive enum change).
- [ ] Educator detail: their scenarios, groups and recent sessions.

## Known gaps (backend)
- [ ] `GET /api/sessions/student/:studentId` checks ownership for educators only; a school_admin is not limited to their school.
- [ ] `PUT /api/students/:id` writes the whole request body to the user.
