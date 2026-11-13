# ISO 27001 readiness — Silver Wings XR

Tracker for all 34 items: [ISO27001_TRACKER.md](ISO27001_TRACKER.md) · step-by-step: [ISO27001_HOWTO.md](ISO27001_HOWTO.md)

Working plan for the auditor's evidence request list (IRL), *Silver Wings XR - ISO 27001 Checklist.xlsx*: 34 items, all still "Requested" as of 2026-11-12.

> The sheet's "Requested on" date is `23-20-2026` on every row — month 20 does not exist. Ask the auditor for the real request date; audit timelines are counted from it.

Owner key: **Mgmt** = leadership / ISMS owner · **HR** · **IT** = endpoints & network · **Eng** = platform (AWS EC2, MongoDB Atlas, this app).

---

## 1. Do now (days, mostly engineering)

These need no outside party and either produce evidence directly or remove findings a pentest would raise.

| Priority | Action | Feeds IRL # | Owner |
|---|---|---|---|
| **P0** | **Close the open `/api/auth/register` hole.** It is unauthenticated and trusts a client-supplied `creatorRole`, so anyone can create a `superadmin`. Require `protect` + a role check, take the creator's role from `req.user`, never the body. | 14, 18, 20 | Eng |
| P0 | **Raise the password policy.** Today the only rule is `minlength: 6` (`backend/models/userModel.js`). Move to ≥ 12 chars with a complexity/denylist check, and screenshot the code + login lockout (`MAX_LOGIN_FAIL_ATTEMPTS`, `backend/routes/authRoutes.js`) as evidence. | 20 | Eng |
| P0 | **Turn on change control.** Protect `main` in GitHub: PRs required, ≥ 1 approving review, no direct pushes. Every change from now on gets a PR with testing notes, impact and a back-out line. The first such PR is the item-30 sample. | 30 | Eng |
| P1 | **Enable MFA** on every AWS root/IAM user, MongoDB Atlas user, GitHub org member and Google Workspace account. Screenshot each setting. | 21 | Eng / IT |
| P1 | **Export privileged users**: AWS IAM users + policies, Atlas database users, GitHub org admins, and the app's `superadmin` / `school_admin` accounts. Date and sign the list. | 10, 18 | Eng |
| P1 | **Screenshot encryption at rest**: Atlas cluster (encryption + backup encryption), EBS volume encryption on the EC2 instance. | 12 | Eng |
| P1 | **Turn on cloud logging and alerts**: AWS CloudTrail (all regions) and a few CloudWatch / billing alarms; Atlas activity feed and alert rules. Export a sample. | 11, 26 | Eng |
| P1 | **Use Sentry as the incident log.** It is wired up as of 2026-11-12. Pick one real issue, write it up as the sample ticket (detection → triage → fix → closure). | 7, 8 | Eng |
| P2 | **Run a user access review**: export all accounts and roles, have a manager mark keep/remove, apply removals, keep the signed sheet. | 16 | Eng + Mgmt |
| P2 | **Backups**: confirm Atlas scheduled snapshots, export 30 days of backup history, then restore one snapshot to a scratch cluster and record the result. | 28, 29 | Eng |
| P2 | **Free vulnerability scan**: `pnpm audit`, GitHub Dependabot, and an OWASP ZAP baseline scan of the dev dashboard. Not a substitute for item 14, but fixes the cheap findings first. | 14 | Eng |
| P2 | **Network diagram**: browser → dashboard / backend domains → EC2 (pm2) → MongoDB Atlas, Redis, Gemini/Groq, StreamPixel, Sentry, PostHog. | 27 | Eng |
| P2 | **Firewall**: export the EC2 security-group rules; close every port that does not need to be public. | 9 | Eng |

## 2. Takes weeks (needs writing, approval or other people)

| Action | Feeds IRL # | Owner | Why it takes time |
|---|---|---|---|
| ISMS manual, Statement of Applicability (all Annex A controls with include/exclude + justification), risk register | 2, 3, 15 | Mgmt | Must be written, then formally approved; the SoA depends on the risk assessment |
| Policy set (access control, password, change management, backup, incident, vendor, acceptable use) + staff acknowledgement | 24, 33 | Mgmt + HR | Approval, then every employee signs; annual re-acknowledgement |
| Security awareness training + attendance record | 5 | HR | Has to be scheduled and delivered |
| Joiner pack (code of conduct, NDA, background check, induction training, access request) and leaver pack (exit checklist, access revocation) | 31, 32 | HR + IT | Needs a real recent joiner/leaver with complete records |
| Endpoint controls: BitLocker, USB blocking, antivirus, patching reports, VPN for org data | 4, 19, 22, 23 | IT | Needs device management (e.g. Intune) rolled out to every laptop |
| Vendor assessments (AWS, MongoDB, Google, Groq, StreamPixel, Sentry, PostHog …) | 25 | Mgmt | Collect each vendor's SOC 2 / ISO certificate, record a review |
| BCP / DR plan and one test | 17 | Mgmt + Eng | Plan first, then a restore/failover exercise |
| Staff evaluations | 6 | HR | Follows the HR review cycle |

## 3. Longest lead time (book early)

| Action | Feeds IRL # | Notes |
|---|---|---|
| External penetration test | 14 | Book a firm now — lead times are weeks. Fix P0 items above first so the report is clean. |
| Internal audit | 13 | Must be independent of whoever built the ISMS; often outsourced. |
| Management review meeting | 34 | Held after the internal audit, with agenda, inputs, outputs and actions minuted. |
| Certificate of incorporation | 1 | Just a document fetch, but confirm which legal entities are in scope. |

## Suggested order

1. **This week:** register-route fix, password policy, branch protection, MFA everywhere, privileged-user export, encryption screenshots, CloudTrail. Book the pentest.
2. **Next 2–4 weeks:** policies + SoA + risk register drafted and approved; training session; backup restore test; access review; endpoint rollout starts.
3. **Before the audit:** pentest done and findings fixed, internal audit, management review.

Track status per item in the IRL sheet's Status / Comments columns, linking to the evidence file for each.
