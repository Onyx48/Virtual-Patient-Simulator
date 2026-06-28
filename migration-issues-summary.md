# Migration Connection Status

## Scripts Built

### 1. `backend/scripts/validateConnections.js`
Validates the full referential integrity chain: School → assignedAdmin → Educators → Students. Checks 16 connection points including role validation, ObjectId references, and login tests.
```bash
npm run validate:connections
```

### 2. `backend/scripts/brokenConnectionsReport.js`
Queries MongoDB and produces `broken-connections-report.json` — a categorised dump of every broken/missing link with full record details (11 categories).
```bash
cd backend && node scripts/brokenConnectionsReport.js
```

### 3. `backend/scripts/repairConnections.js`
Repairs connections by linking existing records only — no creation or guessing. Links educators to schools, assigns admins from existing users, and propagates schoolId from educator to student Users.
```bash
npm run repair:connections
```

### 4. `backend/scripts/migrateFromBubble.js`
Updated with improved linking logic: school matching for educators during import, admin fallback chain (school_admin → educator → leave orphaned), and schoolId propagation from educator to student User.

### 5. NPM scripts added
- `validate:connections` — run connection validation
- `repair:connections` — repair broken links

---

## Current Connection State (as of June 2026)

### Overall DB totals
| Collection | Count |
|------------|-------|
| Schools | 17 |
| Users | 506 |
| Students | 447 |
| Scenarios | 14 |

### Chain completeness
```
School → assignedAdmin → Educators → Students
```

| Link | Total | Connected | Disconnected |
|------|-------|-----------|-------------|
| Schools → admin | 17 | 13 | **4** (SIT, Oxford School, Test University, Olaf's) |
| Educators → schoolId | 29 | 29 | **0** |
| Students → educatorId | 447 | 447 | **0** |
| Users → schoolId (non-superadmin) | ~506 | ~505 | **1** (`principal@subodh.com`) |

### Fully healthy chain example
```
Singapore Institute of Technology → Kapil (admin) → Benjamin + 2 other educators → 388+ students
```

### Remaining issues

| Issue | Count | Details |
|-------|-------|---------|
| Schools with broken admin refs | 9 | `oxford`, `mahaveer`, `subodh`, `ewfbjhebd`, `bdajfknsakjd`, `bsksnks`, `fnkdsjlnoid`, `po43jtpo4mf`, `jewbfoekmv` — their assignedAdmin.id points to deleted users |
| Schools with no admin | 4 | SIT, Oxford School, Test University, Olaf's Private University |
| Schools with zero educators | 11 | oxford, mahaveer, subodh, bdajfknsakjd, bsksnks, fnkdsjlnoid, po43jtpo4mf, jewbfoekmv, Oxford School, Test University, Olaf's |
| User with no schoolId | 1 | `principal@subodh.com` (school_admin) |
| Login failures | 2 | `hnw@gmail.com`, `potter@gmail.com` — wrong password for Temp@123456 |

---

## The Bubble Thing ID Problem

### Why mapping fails
- Educators JSON uses **short IDs** (e.g., `D0CYW5EJ`) and `User` field exports as **email**
- Students/Scenarios/Schools reference educators by **User Thing ID** (e.g., `1749744006448x782183619303833600`)
- Users JSON export **omits Thing IDs entirely**
- No bridge exists between the two identifier systems in the exported data

### Resolution approach (not implementing guessing)
The original "school → Thing ID → first educator" fallback was **rejected** — only direct visible connections are linked. Students with unresolvable Thing IDs were left orphaned and only connected when manually assigned to a real educator.

---

## Raw JSON Source Files (D:\downlaods\tep\tep)

| File | Records | Notes |
|------|---------|-------|
| school/All Schools.json | 5 | Clean |
| educator/All Educators.json | 12 | Clean |
| user/All Users.json | 430 | Has 3 modified versions with enriched fields |
| students/All Students.json | 424 | Has 1 modified version |
| scenario/All Scenarios.json | 46 | Has 4 modified versions (varying sizes, same count) |
| session/All Attempts2s.json | 1,433 | Real session data |
| session/All Attempts.json | 2 | Sample/test data |
| All ScoreSubmissions.json | 464 | Scores aligned with students |
