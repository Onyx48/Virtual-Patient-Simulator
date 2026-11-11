# Superadmin (the vendor): how we think

Written 2026-11-08 from `research_notes/VPS stakeholder mindsets/vendor_market.md`, `institutions.md`
and `reports/VPS stakeholder mindsets.md`. **[E]** cited there, **[I]** inference.

## Who it is

Us: the team running VPS for several institutions (SIT now; Tung Wah, Shinshu, NUH next). We set
schools up, keep them live, and need pilots to turn into renewals [E: pilotitis].

## How we think

| # | We think | What it means for the screens | Basis |
|---|---|---|---|
| V1 | "Which schools are actually using it?" A pilot that goes quiet does not renew. | Per-school sessions (30 d) and active students (7 d), quiet schools surfaced. | [E] pilotitis |
| V2 | "Whose subscription ends soon?" | Days left on every school; anything under 30 days flagged. | [I] |
| V3 | "Did the school ever get going?" | Admin not invited / invited but never signed in / no educators / no scenarios, each as an action. | [I] |
| V4 | "Is the platform healthy?" | Sessions per week across all schools. | [I] |
| V5 | "We are a data intermediary." PDPA; sub-processors. | Counts only on the vendor screens; no student names or transcripts by default. | [E] PDPA, Pertama |
| V6 | "Set a school up in two minutes." | One form: name, contact, plan, start date; end date follows from the duration. | [I] |

## Technicalities

- `GET /api/dashboard/platform-overview` (superadmin only): totals, 12 weeks of sessions, per-school adoption, admin set-up, renewal.
- Schools: `/api/schools` (paged), `POST /api/schools/:id/invite` (creates or re-invites the school admin, new password).
- Screens: `src/roles/superadmin/Dashboard.jsx`, `src/roles/superadmin/schools/{Schools,SchoolFormPage}.jsx`.
