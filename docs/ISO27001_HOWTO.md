# ISO 27001 — how to produce the engineering evidence

Step-by-step for the items in [ISO27001_READINESS.md](ISO27001_READINESS.md). Save every screenshot / export as `IRL-<number>-<short-name>-<YYYY-MM-DD>` and log it in [ISO27001_TRACKER.md](ISO27001_TRACKER.md).

---

## Branch protection on GitHub (IRL #30) — do this first

`gh` is not installed on the dev machine, so do it in the browser (needs repo admin):

1. github.com/Onyx48/Virtual-Patient-Simulator → **Settings → Branches → Add branch ruleset** (or *Add classic branch protection rule*).
2. Name `protect-main`, target branch `main`, enforcement **Active**.
3. Tick:
   - **Restrict deletions**
   - **Require a pull request before merging** → required approvals **1**, *dismiss stale approvals when new commits are pushed*
   - **Block force pushes**
4. Leave the bypass list empty (admins included). Save.
5. Screenshot the rule → evidence for IRL #30.

From then on every change goes `dev branch → pull request → review → merge`. The PR description template should carry the four things item 30 asks for:

```
## Change
## Testing evidence
## Impact assessment
## Back-out plan
```

(Optional: save that as `.github/pull_request_template.md` so GitHub pre-fills it.)

---

## Logging, alerts and incidents (IRL #7, #8, #11, #26)

### AWS CloudTrail — cloud event logs (#11)
1. AWS console → **CloudTrail → Trails → Create trail**.
2. Name `org-audit-trail`, **apply to all regions**, new S3 bucket, **log file SSE-KMS encryption on**, **log file validation on**.
3. Events: Management events → Read + Write.
4. Evidence: screenshot of the trail settings, plus **Event history → filter last 7 days → Download CSV**.

### AWS CloudWatch / Billing alarms — usage alerts (#26)
1. **Billing → Budgets → Create budget** → monthly cost budget, alert at 80 % and 100 % to the admin email.
2. **CloudWatch → Alarms → Create alarm** on the EC2 instance: `CPUUtilization > 80 % for 10 min`, and `StatusCheckFailed ≥ 1` → SNS email.
3. Evidence: screenshot of the alarm list and one alert email received.

### MongoDB Atlas — activity and alerts (#11, #26)
1. Atlas → **Project → Activity Feed** → export / screenshot last 30 days.
2. **Alerts → Alert Settings**: confirm alerts for *Host down*, *Connections > 80 %*, *Disk > 80 %*, *Replication lag* → email the admin. Screenshot.

### Sentry as the incident log (#7, #8)
Sentry is connected (backend + frontend) as of 2026-11-12.
1. sentry.io → **Alerts → Create alert → Issues**: *a new issue is created* → email / Slack the on-call. Screenshot.
2. For each real issue worth calling an incident, keep a short record (a GitHub issue labelled `incident` works):
   - detected (Sentry link, time) · impact · root cause · fix (PR link) · closed (time) · lessons
3. #7 = one such record. #8 = the list of those records for the last 6 months (export the GitHub issues with label `incident`). If there were none, say so in writing and sign it.

---

## Backups, access review, scans, firewall

### Backup logs + restore test (#28, #29, #12)
1. Atlas → cluster → **Backup**: confirm *Cloud Backup* on, snapshot schedule and retention. Screenshot (also shows **encryption at rest** for #12 under *Security → Advanced*).
2. **Snapshots** tab → screenshot the list covering the last 30 days → #29.
3. Restore test → #28: **Restore** a recent snapshot into a *new, temporary* cluster (never over the live one). Connect, run a count of `users` and `scenarios`, compare with production, record times and result, then delete the temp cluster.
4. EC2: **EC2 → Volumes** → screenshot showing *Encryption: Encrypted* → #12.

### User access review (#16, #18, #10)
1. Export privileged users (the app's): run in Atlas *Data Explorer* or mongosh on `users`:
   `{ role: { $in: ["superadmin", "school_admin"] } }` → project `name, email, role, schoolId, createdAt` → export CSV.
2. Export AWS IAM users (**IAM → Users → Download**), Atlas DB users (**Database Access**), GitHub org/repo members with admin.
3. Put them in one sheet with a **Keep / Remove** column; a manager signs and dates it.
4. Remove what was marked, screenshot the after-state. The signed sheet = #16; the lists = #18 and #10.
5. Repeat quarterly.

### Vulnerability scanning (#14 — preparation, not a replacement for the pentest)
On the dev machine, from the repo root:
```bash
pnpm audit --prod                      # dependency CVEs → save the output
```
- GitHub → **Settings → Code security** → enable **Dependabot alerts** and **Dependabot security updates**.
- OWASP ZAP baseline scan of the dev dashboard (Docker):
  ```bash
  docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://dev.dashboard.proroleplay.com -r zap-report.html
  ```
  Only scan hosts you own. Fix highs, keep the report.

### Firewall (#9)
1. **EC2 → Security Groups** → the instance's group → **Inbound rules**. Target state:
   | Port | Source | Why |
   |---|---|---|
   | 443 | 0.0.0.0/0 | HTTPS (dashboard, backend) |
   | 80 | 0.0.0.0/0 | Only to redirect to 443 / Certbot |
   | 22 | your office/home IP `/32` only | SSH admin |
2. Remove any rule exposing 5001, 5173, 6379 or 27017 to `0.0.0.0/0`.
3. On the server: `sudo ufw status` (optional host firewall). Screenshot both → #9.

### Network diagram (#27)
Done: [NETWORK_DIAGRAM.md](NETWORK_DIAGRAM.md). Tick its *To confirm on the server* list, then export an image from mermaid.live.
