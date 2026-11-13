# Disaster Recovery Plan

**Organisation** Silver Wings XR
**System** Virtual Patient System (VPS)
**Version** 2.1 · **Date** [DD Month YYYY]
**Owner** Technology Lead · **Approver** [Approver name], [Approver designation]

Supports ISO/IEC 27001:2022 controls A.5.29, A.5.30, A.8.13 and A.8.14.
Read with the Business Continuity Plan and the Backup Policy.

---

## 1. Purpose and scope

This plan defines how the VPS platform is recovered after a disruptive event, and
sets the recovery objectives that the backup design must satisfy.

**In scope:** the VPS platform — its web dashboard, backend API and data — hosted in
AWS account 278530062248 (resources tagged `Scope=ISMS-VPS`) and MongoDB Atlas.

**Out of scope:**
- **Voxio and CaseIndex**, including EC2 instances `i-0da8290e5bcd9b586` and
  `i-0ad6c70e26fec404c`, their volumes, security groups and domains. These are
  excluded from the ISMS entirely; see *ISMS Scope Exclusions* (ISMS_SCOPE_EXCLUSIONS.md).
- The simulator game and its streaming service (StreamPixel).
- The internal operations of third-party providers (OpenRouter, MongoDB Atlas,
  Sentry, PostHog). Their availability is addressed through the Vendor Management Policy.

---

## 2. Recovery objectives

**RTO (Recovery Time Objective)** — maximum tolerable time from incident declaration
to service restoration.

**RPO (Recovery Point Objective)** — maximum tolerable data loss, expressed as time.

### Platform-wide targets

| Objective | Target |
|---|---|
| **RTO** | **8 hours** |
| **RPO** | **24 hours** |

These are consistent with the availability objective of 99.5% per quarter recorded
in the ISMS Scope Statement, which permits approximately 10.8 hours of unplanned
downtime per quarter.

### Per-service targets

| Service | Host | RTO | RPO | Rationale |
|---|---|---|---|---|
| VPS application (dashboard + backend) | `frontend-dev` i-0f2dd8d5adee2da20 | 8 h | 24 h | Primary teaching and assessment interface. Code is in GitHub, so it is rebuilt by redeploying, not restored |
| VPS backend services | `vps-backend` i-0ac167fb7b1203443 | 8 h | 24 h | Supports the application tier |
| Database | **MongoDB Atlas** (`vps.sg6bgd3.mongodb.net`) | 8 h | **24 h** | Learner, scenario and session records. Backed up by Atlas Cloud Backup, not AWS Backup |
| Redis | On the backend instance | n/a | n/a | Not backed up: holds only OTP codes and login-lockout counters, which expire within minutes |
| Application secrets (`.env`) | Backend instance → AWS SSM Parameter Store | 1 h | n/a | Not in Git; without a copy, the app cannot be restarted on a new instance |
| User uploads (`uploads/`) | Backend instance disk | 8 h | 24 h | Profile pictures and bulk-import files; covered by daily volume snapshots or an S3 copy |
| Static assets | S3 | 4 h | 24 h | Versioning enabled on two buckets |
| DNS | Route 53 (`proroleplay.com`) | 1 h | n/a | Configuration change only |

**Interpretation of RPO 24 h:** in the worst case, up to one day of learner session
and assessment data may be lost. This is accepted on the basis that sessions are
re-runnable and assessments can be repeated.

---

## 3. Current state and gap

> **This section must be removed once the gap is closed. It is recorded here so that
> the plan reflects reality rather than intent.**

As at 12 November 2026 the stated objectives **are not met**:

| Finding | Evidence |
|---|---|
| No automated backup of any EC2 instance or volume | AWS Backup: 0 backup jobs in 30 days |
| No recovery points exist | AWS Backup: 0 recovery points |
| The only backup plan targets EFS, which does not exist in the account | `aws/efs/automatic-backup-plan` |
| MongoDB Atlas backup status not yet confirmed (the free M0 tier has no backups) | Atlas console — to check |
| `.env` secrets exist only on the instance | No secrets store in use |
| No restore has ever been tested | No test record |
| All 14 EBS volumes are unencrypted | `EbsEncryptionByDefault: False` |
| Only 3 EBS snapshots exist, all incidental AMI artefacts from Apr and Jul 2026 | `describe-snapshots` |

**Current effective RPO: undefined (total loss likely). Current effective RTO:
unknown (untested).**

Closure is tracked as treatment plan items BR-01 to BR-04 in section 7.

---

## 4. Backup design required to meet the objectives

| Item | Requirement |
|---|---|
| Method | AWS Backup plan covering all in-scope EC2 instances and EBS volumes |
| Frequency | Daily, 02:00 UTC — satisfies RPO 24 h |
| Retention | 30 days operational, 12 months monthly archive |
| Encryption | AWS KMS customer-managed key; backup vault encrypted |
| Vault lock | Enabled, to prevent deletion by a compromised administrator |
| Database | MongoDB Atlas Cloud Backup (daily snapshots, 30-day retention); if the cluster tier has no backup, a daily `mongodump` to S3 |
| Secrets | `.env` stored in AWS SSM Parameter Store (SecureString), updated on every change |
| Cross-region copy | Snapshots copied to a second region |
| Monitoring | CloudWatch alarm on backup job failure, routed to a monitored SNS topic |

---

## 5. Recovery procedures

### 5.1 Declaration

Any of the following triggers this plan: loss of an in-scope EC2 instance, data
corruption or loss, loss of an AWS Availability Zone or Region, or ransomware.

The **Technology Lead** declares a disaster and notifies **Kapil Chhabra** (data
owner) and top management. The declaration time starts the RTO clock.

### 5.2 Scenario A — single instance failure *(RTO 4 h)*

1. Confirm failure via CloudWatch and direct connection attempt.
2. Launch a replacement instance from the latest AMI or recovery point.
3. Attach the most recent volume snapshot.
4. Restore `.env` from SSM Parameter Store, `git pull` the release branch, run
   `pnpm install && pnpm build`, and start the processes with `pm2 start ecosystem.config.cjs`.
5. Update the DNS A record in Route 53 (`proroleplay.com`) to the new address.
6. Verify application health and authentication.
7. Record the event in the incident register.

> **Dependency:** production instances currently use dynamic public IP addresses.
> Until Elastic IPs are attached, every recovery requires a manual DNS change at an
> external registrar, which materially extends RTO.

### 5.3 Scenario B — data loss or corruption *(RTO 8 h, RPO 24 h)*

1. Stop application traffic to prevent further writes.
2. Identify the last known-good recovery point.
3. Restore the Atlas snapshot to a new cluster; do not overwrite the damaged one, which is
   preserved for investigation. Point `MONGODB_URI` at the restored cluster.
4. Validate record counts and a sample of recent sessions with the data owner.
5. Reconnect the application and resume traffic.
6. Record the quantity of data lost against the RPO target.

### 5.4 Scenario C — region loss *(RTO 24 h)*

1. Restore cross-region snapshot copies in the secondary region.
2. Rebuild instances from AMIs held in that region.
3. Repoint DNS.
4. Accept degraded performance until the primary region is restored.

### 5.5 Scenario D — ransomware or account compromise *(RTO 24 h)*

1. Isolate affected instances by removing security group ingress.
2. Revoke all IAM access keys and force credential rotation.
3. Restore from a vault-locked recovery point predating the compromise.
4. Rebuild rather than clean infected hosts.
5. Assess whether personal data was affected; if so, follow the PDPA notification
   process in the Data Protection Policy within 3 calendar days.

---

## 6. Testing

| Test | Frequency | Evidence produced |
|---|---|---|
| Restore a single volume to a test instance | Quarterly | Restore log, time taken, RPO achieved |
| Full application recovery exercise | Annually | DR test report, RTO achieved, issues raised |
| Backup job success review | Monthly | Backup job report |

A test is successful only when the measured RTO and RPO meet the targets in
section 2. Failures are raised as nonconformities under the Nonconformity and
Corrective Action Policy.

**Last test: none. First test due: [date].**

---

## 7. Treatment plan

| Ref | Action | Owner | Due |
|---|---|---|---|
| BR-01 | Create an AWS Backup plan covering all in-scope instances, daily, 30-day retention | Technology Lead | [date] |
| BR-02 | Enable EBS encryption by default and re-encrypt existing volumes | Technology Lead | [date] |
| BR-03 | Attach Elastic IPs to production instances to remove the manual DNS step | Technology Lead | [date] |
| BR-04 | Perform and document the first restore test | Technology Lead | [date] |
| BR-05 | Configure CloudWatch alarm on backup failure with a monitored subscriber | Technology Lead | [date] |
| BR-06 | Confirm the MongoDB Atlas tier and enable Cloud Backup (or a daily `mongodump` to S3) | Technology Lead | [date] |
| BR-07 | Store `.env` in SSM Parameter Store | Technology Lead | [date] |
| BR-08 | Tag VPS resources `Scope=ISMS-VPS` and excluded resources `Scope=Out` | Technology Lead | [date] |

---

## 8. Roles

| Role | Responsibility | Holder |
|---|---|---|
| Technology Lead | Declares disaster, leads recovery, owns this plan | [name] |
| Data Owner | Validates restored data, decides on acceptable loss | Kapil Chhabra |
| Top Management | Authorises extended downtime, external communication | [name] |

---

## 9. Review

Reviewed at least annually, after any DR test, and after any significant change to
the platform or its hosting arrangements.

| Version | Date | Author | Approver | Change |
|---|---|---|---|---|
| 1.0 | [date] | [name] | [name] | Initial issue |
| 2.0 | [DD Month YYYY] | [name] | [name] | Added measurable RTO/RPO, current-state gap, treatment plan |
| 2.1 | 12 November 2026 | [name] | [name] | Voxio and CaseIndex excluded; database corrected to MongoDB Atlas; added secrets, uploads and Redis; DNS limited to Route 53 |
