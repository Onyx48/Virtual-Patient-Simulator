# Educator screens: what to add, remove, change

Started 2026-11-08. Rounds 1–3 done the same day (lint and build pass; not yet checked in a browser). Each line ties back to a row of `mindsets/educator.md` (M1–M12). Status:
**[1]** in iteration 1 · **[ ]** open · **[x]** done · **[b]** needs a backend change first.
Small things are listed on purpose: they are most of the work and most of the feel.

## Everywhere (shell)

- [x] Ctrl+B collapses the sidebar (done 2026-11-08), `?` opens a keyboard shortcut sheet.
- [x] Logo shown as is, no white tile (dark mode looked like a box in a box).
- [x] Toasts in the vx style (rounded, ink on card), bottom-centre, not the default react-hot-toast.
- [x] Copy-to-clipboard helper with a "Copied" tick, used for every ID, email and name.
- [x] Global search in the header: students and scenarios by name, `/` to focus. (M7)
- [x] Page titles in the browser tab ("Students · VPS").
- [x] Remember scroll position when coming back from a detail page.
- [x] Empty states that say the next action ("No students yet. Upload your roster.").
- [ ] Dark mode for the pages not yet converted (school admin, superadmin, student, sign-in). *Not educator screens; left for the other roles' pass.*
- [x] Relative times on the educator screens (last session, feeds, edited, drawer) ("3 days ago") with the full date on hover.
- [x] Session expiry: redirect to sign-in on the first 401 instead of silent errors.

## Dashboard — "who needs me, what did the cohort miss" (M6, M7, M10)

- [x] **Needs you** panel at the top, from data already loaded:
  never logged in · login details never sent · assigned but no sessions · average under 50% ·
  draft scenarios not published · published scenarios assigned to nobody. Each row: count, the names, one action.
- [x] Every KPI card clickable to the filtered list it counts (Students → /students).
- [x] Remove the "Average time" card when it is 0m; show "No sessions yet" not "0%".
- [x] Recent activity: the last sessions (student, scenario, score, when), click opens the transcript.
- [x] **Cohort misses** (b): per grading question, % of sessions that got it "no", worst first. (M6) Needs `GET /api/dashboard/question-misses`.
- [x] Score distribution histogram per scenario (bklit bar), not just averages. (M6)
- [x] Group filter on the dashboard (applies to misses, recent sessions and score spread; the top KPI cards stay all-time).
- [x] Date range (this week / month / term).
- [x] "Print summary" (browser print / save as PDF) for the programme lead. (M10)
- [x] Distress flags surfaced as an alert row, never buried in a transcript. (M11)

## Students (M7, M12)

- [x] Copy email and copy ID on hover, with a tick.
- [x] **Remind**: `mailto:` with a prefilled practice reminder (subject + body naming the student). Real email later (b).
- [x] Select rows (checkbox + shift-click range) → bulk bar: copy emails, email selected (BCC), clear.
- [x] **Last active** column ("3 days ago"; "Never") from `lastSessionAt` / `lastLoginAt` (small backend change).
- [x] Whole row opens the transcripts; Edit/Delete stay as buttons.
- [x] Export CSV of the current filter (name, email, group, sessions, avg, best, last active, login status).
- [x] "Not started" filter preset (assigned, zero sessions) next to the existing ones.
- [x] Resend → label "Send new password" with a key icon, since it does replace the password.
- [x] Group filter in the toolbar; change group from the chip menu.
- [x] Student detail drawer: sessions over time (bklit line), per-scenario best, reflections, notes.
- [x] Educator private note per **session** (in Transcripts). Per-student note still open. (M3)
- [x] Score trend: in the student drawer as a bklit line (a per-row sparkline would need every student's history per page).
- [x] Bulk move to group, bulk delete with type-to-confirm.
- [x] Sort by last session (column header). [ ] Default "needs attention first" sort: open, needs a ranking rule agreed with educators.

## Scenarios (M1)

- [x] **Duplicate** a scenario (copy, "(copy)" suffix, saved as Draft) — reuse across cohorts.
- [x] Publish / Unpublish from the card menu without opening the form.
- [x] Copy scenario ID.
- [x] Card shows profession (PT/OT), setting (Singapore/General) and difficulty as chips.
- [x] Card shows "N students · M sessions · avg X%" so a weak case is visible without opening it.
- [x] Preview: Test on the card and in the editor opens the simulator.
- [x] Archive instead of delete; "Archived" filter shows them.
- [x] Per-scenario insights (dialog): who did it, score spread, common misses, transcripts.
- [x] Assign from the card (opens Assign with that scenario open).
- [x] Last edited "2 days ago by you".

## New / edit scenario (M1, M3)

- [x] Ctrl+S saves (draft if not ready); Ctrl+Enter sends the AI box.
- [x] Warn before leaving with unsaved changes.
- [x] Version history for this sitting (each AI change and save, restore). Persisted history across visits: open (b).
- [x] "Test" button that opens the simulator for this draft.
- [x] Word count on long fields; "Copy prompt" for the whole case.
- [x] Suggested AI requests as chips ("make them more anxious", "add a red flag", "older patient").

## Transcripts (M4, M5, M8, M9)

- [x] Copy transcript (plain text) and Print.
- [x] Search inside the conversation, highlighting matches.
- [x] Count of student questions, and share of open vs closed questions (heuristic: starts with what/how/tell/describe/can you describe). (M8)
- [x] Evidence click: grading question → scroll to the matching line in the conversation. (M4)
- [x] Educator override of a question verdict + note, logged (b). (M3)
- [ ] Mark "ASR error" on a line (b). (M9)
- [x] Compare two attempts, question by question.
- [ ] Timestamps per message and total duration. *Blocked: transcripts store no per-message time.*

## Assign scenarios

- [x] Start from a student: "Assign to Aiko" from the row.
- [x] Search inside the student list; filter by group.
- [ ] Due date per assignment (b) — reminders key off it.

## Settings

- [x] Default view (cards/table), default rows per page, theme, language in one place.
- [ ] Notification preferences once real reminders exist (b).
