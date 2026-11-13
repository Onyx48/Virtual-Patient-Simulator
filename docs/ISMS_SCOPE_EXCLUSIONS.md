# ISMS scope exclusions — Voxio and CaseIndex

**Organisation** Silver Wings XR · **System** Virtual Patient System (VPS)
**Decision date** 12 November 2026
Supports ISO/IEC 27001:2022 clause 4.3 (scope of the ISMS).

---

## Decision

**Voxio and CaseIndex are entirely outside the scope of the Silver Wings XR ISMS.** No control review, evidence, testing, backup, recovery, vulnerability or supplier assessment is performed or provided for them under this ISMS.

## Excluded resources

| Product   | Resource                                             | Identifier            | Domain           |
| --------- | ---------------------------------------------------- | --------------------- | ---------------- |
| Voxio     | EC2 instance `dashbaord`                             | `i-0da8290e5bcd9b586` | `*.voxio.in`     |
| CaseIndex | EC2 instance `vps-backend-prd` (Windows Server 2025) | `i-0ad6c70e26fec404c` | `*.caseindex.io` |

The exclusion covers each instance together with its attached EBS volumes, snapshots, AMIs, security groups and Elastic IPs; the domains above and their registrars (**GoDaddy** for `voxio.in`, **Namecheap** for `caseindex.io`); and the CaseIndex supplier relationship.

All excluded AWS resources carry the tag `Scope=Out`. All in-scope VPS resources carry `Scope=ISMS-VPS`.

## Justification

Voxio and CaseIndex are separate products. They:

- do not store, process or transmit VPS data, including learner, scenario, session or account data;
- share no database, credentials, secrets or network path with VPS resources (separate security groups; no access to the VPS MongoDB Atlas cluster; no use of VPS environment secrets);
- are not called by the VPS platform. The VPS conversation engine replaced Voxio's chat service in 2026 and runs in the VPS backend.

## What remains in scope

AWS account **278530062248** is shared, so controls that operate at **account level** stay in scope because they protect VPS resources. Silver Wings XR will comply with them in full:

- IAM users, roles, privileged access and the root account
- multi-factor authentication and the IAM password policy
- CloudTrail logging, security alarms and alert routing
- account defaults, e.g. EBS encryption by default

These are account controls, not a review of Voxio or CaseIndex.
