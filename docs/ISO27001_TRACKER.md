# ISO 27001 IRL tracker — all 34 items

Source: *Silver Wings XR - ISO 27001 Checklist.xlsx*. Update this table whenever work lands. How-to: [ISO27001_HOWTO.md](ISO27001_HOWTO.md). Plan: [ISO27001_READINESS.md](ISO27001_READINESS.md).

**Status:** ⬜ Not started · 🟨 In progress · ✅ Evidence ready · ⏸ Parked (company docs — deferred by decision 2026-11-12)
**Owner:** Mgmt · HR · IT (endpoints/network) · Eng (platform)

## Progress — 2026-11-12

| Status | Count | Items |
|---|---|---|
| ✅ Done | 0 | — |
| 🟨 In progress | 7 | 7, 8, 14, 17, 20, 27, 30 |
| ⬜ Not started | 14 | 4, 9, 10, 11, 12, 16, 18, 19, 21, 22, 23, 26, 28, 29 |
| ⏸ Parked (company docs) | 13 | 1, 2, 3, 5, 6, 13, 15, 24, 25, 31, 32, 33, 34 |

**Overall: 10.3 % of all 34** · **16.7 % of the 21 active (non-parked) items** — scoring done = 100 %, in progress = 50 %. Update this block with every change.

| # | Requirement (short) | Owner | Status | What's done / what it needs | Evidence |
|---|---|---|---|---|---|
| 1 | Certificate of incorporation | Mgmt | ⏸ | Company document | |
| 2 | Statement of applicability | Mgmt | ⏸ | Company document | |
| 3 | ISMS manual | Mgmt | ⏸ | Company document | |
| 4 | Latest patching report | IT | ⬜ | Endpoint patching (device management). Server side: `sudo apt list --upgradable` was 58 pending on 2026-11-11 → run `sudo apt upgrade` and keep the log | |
| 5 | Security training attendance | HR | ⏸ | Company / HR | |
| 6 | Last staff evaluation | HR | ⏸ | Company / HR | |
| 7 | 1 incident ticket | Eng | 🟨 | Sentry connected 2026-11-12 (backend + frontend). Needs alert rule + one written-up incident — HOWTO § Sentry | |
| 8 | Security incidents, last 6 months | Eng | 🟨 | Same source as #7. **Candidate entries:** the `/register` privilege-escalation and `/reset-password` takeover holes found and fixed 2026-11-12 (see #20 row) | |
| 9 | Firewall configuration | Eng | ⬜ | EC2 security group export; close 5001/5173 to the internet — HOWTO § Firewall | |
| 10 | Cloud provider administrators | Eng | ⬜ | IAM / Atlas / GitHub admin export — HOWTO § Access review | |
| 11 | Cloud provider event logs | Eng | ⬜ | CloudTrail + Atlas activity feed — HOWTO § Logging | |
| 12 | DBs and backups encrypted | Eng | ⬜ | Atlas encryption + backup screenshots, EBS encryption — HOWTO § Backups | |
| 13 | Internal audit report | Mgmt | ⏸ | Independent auditor | |
| 14 | Vulnerability scan + pentest | Eng | 🟨 | **Fixed 2026-11-12:** unauthenticated superadmin creation via `/api/auth/register`; password reset without OTP proof via `/api/auth/reset-password`; plaintext passwords written to logs. Next: `pnpm audit`, Dependabot, ZAP baseline, then book external pentest | |
| 15 | Risk register + approval | Mgmt | ⏸ | Company document | |
| 16 | Last user access review | Eng + Mgmt | ⬜ | Export + Keep/Remove sign-off — HOWTO § Access review | |
| 17 | BCP and DR test report | Mgmt + Eng | 🟨 | DR plan v2.1 in repo, VPS-only: Voxio/CaseIndex excluded, database corrected to MongoDB Atlas, `.env`/uploads/Redis added, BR-06 to BR-08 added. Still needs names, dates, approval, then the test (= #28) | `docs/DISASTER_RECOVERY_PLAN.md` |
| 18 | Privileged users, all apps/servers | Eng | ⬜ | App `superadmin`/`school_admin` query + IAM/Atlas/GitHub — HOWTO § Access review. Account creation is now restricted by role (see #20) | |
| 19 | VPN required for org data | IT | ⬜ | **Yours (item 4 of the plan)** | |
| 20 | Password parameters configured | Eng | ✅ code / ⬜ cloud | **App, done 2026-11-12:** `backend/utils/passwordPolicy.js` — 12–128 chars, letter + digit, common-password and email-name checks, enforced on signup, admin-set passwords, student create, reset and change-password; login lockout in `authRoutes.js`. Still to screenshot: AWS IAM and Atlas password policies | `backend/utils/passwordPolicy.js` |
| 21 | MFA on IT infrastructure | IT / Eng | ⬜ | **Yours (item 4 of the plan)** — AWS, Atlas, GitHub, Google | |
| 22 | BitLocker + no removable media | IT | ⬜ | Device management | |
| 23 | Anti-virus DAT version/date | IT | ⬜ | Device management | |
| 24 | Vendor management policy | Mgmt | ⏸ | Company document | |
| 25 | Annual vendor assessment | Mgmt | ⏸ | Vendor list is in [NETWORK_DIAGRAM.md](NETWORK_DIAGRAM.md) (AWS, MongoDB, Google, Groq, StreamPixel, Sentry, PostHog) | |
| 26 | Cloud usage-threshold alerts | Eng | ⬜ | AWS Budgets + CloudWatch + Atlas alerts — HOWTO § Logging | |
| 27 | Latest network diagram | Eng | 🟨 | Drafted 2026-11-12: [NETWORK_DIAGRAM.md](NETWORK_DIAGRAM.md). Confirm the checklist at its end on the server, export image | `docs/NETWORK_DIAGRAM.md` |
| 28 | Last backup restoration | Eng | ⬜ | Atlas restore to a temp cluster — HOWTO § Backups | |
| 29 | Backup logs, last 30 days | Eng | ⬜ | Atlas snapshot list — HOWTO § Backups | |
| 30 | Sample change (approval, testing, back-out, impact) | Eng | 🟨 | Branch protection steps in HOWTO (needs repo admin in the browser — `gh` not installed). **Use the 2026-11-12 auth fix as the sample change** once it goes through a PR | |
| 31 | Joiner pack | HR | ⏸ | Company / HR | |
| 32 | Leaver pack | HR + IT | ⏸ | Company / HR | |
| 33 | Policies shared + acknowledged | Mgmt | ⏸ | Company document | |
| 34 | Management review minutes | Mgmt | ⏸ | Company document | |

## AWS internal audit findings (2026-11-12, account 278530062248)

From the auditor's *CLAUDE-TECH-BRIEF.md*. Each row is open until `verify-remediation.sh` reports PASS.

**Scope:** Voxio (`i-0da8290e5bcd9b586`) and CaseIndex (`i-0ad6c70e26fec404c`) are excluded entirely ([ISMS_SCOPE_EXCLUSIONS.md](ISMS_SCOPE_EXCLUSIONS.md)). Tasks 5, 6, 8, 10 and 11 apply to VPS resources only. Account-level tasks (1, 2, 3, 4, 9) still apply in full.

| Brief task | Finding | Closes / feeds IRL # | Risk |
|---|---|---|---|
| 1 CloudTrail | MAJ-02 — no trail in any region | 11, 26 | none |
| 2 IAM password policy | MIN-01 — none set | 20 | none |
| 3 EBS encryption by default | new volumes unencrypted | 12 | none |
| 4 Dormant admins + root key | MAJ-04 — 3 admins, no MFA, 1–3 yrs idle; root key from 2022 | 10, 16, 18, 21 | needs HR confirmation |
| 5 Orphaned security groups | MAJ-05 pt 1 — 197 open rules | 9 | none |
| 6 Malware protection | MIN-03 — no AV/EDR on any host | 23 | low (ClamAV RAM) |
| 7 Elastic IPs | dynamic IPs on prod | prerequisite for 10 | brief IP change |
| 8 Restrict SSH | MAJ-05 pt 2 — SSH open to the internet | 9 | low |
| 9 Security alarms | no alarms / SNS subscriber | 11, 26 | none |
| 10 Encrypt volumes | MIN-04 — 15 volumes, 1,172 GB | 12 | **downtime** |
| 11 Backups + restore test | MAJ-03 — zero recovery points | 28, 29, 17 | none |

## Change log

| Date | Change | Items |
|---|---|---|
| 2026-11-12 | Closed `/register` privilege escalation (role from JWT, not request body; school scoped to creator) | 14, 18, 8 |
| 2026-11-12 | Closed `/reset-password` takeover (requires 10-min single-use token from `/verify-otp`) | 14, 8 |
| 2026-11-12 | Password policy 12+ chars, letter+digit, denylist; stopped logging plaintext passwords | 20, 14 |
| 2026-11-12 | Network diagram, how-to guide, this tracker | 27, all |
| 2026-11-12 | Sentry + PostHog connected | 7, 8, 11 |
| 2026-11-12 | AI provider list + ISMS scope drafted: [AI_PROVIDERS_AND_SCOPE.md](AI_PROVIDERS_AND_SCOPE.md) | 2, 24, 25, 27 |
| 2026-11-12 | DR plan v2.0 draft received and reviewed | 17, 28, 29 |
| 2026-11-12 | AI providers confirmed: OpenRouter, Whisper base (local, in game), ElevenLabs (TTS) | 24, 25 |
| 2026-11-12 | Voxio and CaseIndex excluded from ISMS scope; DR plan v2.1 made VPS-only | 2, 17, 25 |
| 2026-11-12 | AWS audit findings mapped to IRL items (not yet actioned) | 9–12, 16, 18, 20, 23, 26, 28, 29 |
