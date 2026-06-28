# 📐 Import Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUBBLE.IO JSON FILES                         │
│  (school/, user/, educator/, students/, scenario/)              │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐        ┌──────────────────────┐
│  MIGRATION SCRIPT   │        │   API ENDPOINTS      │
│ (Node.js Standalone)│        │ (Express Backend)    │
│                     │        │                      │
│ • Validation        │        │ POST /import/bulk    │
│ • Transform Data    │        │ POST /import/schools │
│ • Upsert to DB      │        │ GET  /import/status  │
│ • Error Handling    │        │                      │
└──────────┬──────────┘        └──────────┬───────────┘
           │                              │
           │                              │
           └──────────────┬───────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │   MONGODB     │
                  │   (Main DB)   │
                  └───────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
    Schools            Users           Students
    Educators          Educators       Scenarios
    ---------          ---------       ---------
    5+ records         150+ records    500+ records
```

---

## Data Flow Diagram

### Before Import (Bubble.io)
```
┌──────────────┐      ┌──────────────┐
│   SCHOOLS    │      │    USERS     │
│ Name: SIT    │      │ Email: xxx   │
│ Email: x@y.z │      │ Role: yes/no │
└──────────────┘      └──────────────┘
       │ (contains)            │
       │ Educator IDs          │ (is_educator)
       │ (comma-separated)     │
       └─────────────┬─────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   ┌──────────────┐        ┌─────────────┐
   │  EDUCATORS   │        │  STUDENTS   │
   │ Email: xxx   │        │ Email: xxx  │
   │ ID: N89S6YU0 │        │ Educator:xxx│
   └──────────────┘        └─────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │ SCENARIOS   │
                          │ Educator:xxx│
                          └─────────────┘
```

### After Import (MongoDB)
```
┌──────────────────────────────────────────────────┐
│                   SCHOOLS (Collection)            │
│                                                   │
│  {                                                │
│    _id: ObjectId,                                 │
│    schoolName: "SIT",                             │
│    email: "rntayllor@gmail.com",                  │
│    subscription: "Subscription (1 Year)",         │
│    assignedAdmin: {                               │
│      id: ObjectId → User                          │
│    }                                              │
│  }                                                │
└──────────────────────────────────────────────────┘
                        │
                        │ schoolId (Foreign Key)
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   USERS (Collection)     │   │  STUDENTS (Collection)   │
│                          │   │                          │
│ {                        │   │ {                        │
│   _id: ObjectId,         │   │   _id: ObjectId,         │
│   name: "Admin Kapil",   │   │   user: ObjectId→User,   │
│   email: "xxx@y.z",      │   │   educatorId:            │
│   role: "school_admin",  │   │     ObjectId→User,       │
│   schoolId: ObjectId     │   │   school: "SIT",         │
│ }                        │   │   enrollmentDate: Date,  │
│                          │   │   assignedScenarios: [   │
│ {                        │   │     ObjectId→Scenario    │
│   _id: ObjectId,         │   │   ]                      │
│   name: "Benjamin",      │   │ }                        │
│   email: "xxx@y.z",      │   └──────────────────────────┘
│   role: "educator",      │
│   schoolId: ObjectId  ──┤┐  ┌──────────────────────────┐
│ }                        ├─→ │ SCENARIOS (Collection)   │
│                          │   │                          │
│ {                        │   │ {                        │
│   _id: ObjectId,         │   │   _id: ObjectId,         │
│   name: "John Tan",      │   │   scenarioName: "...",   │
│   email: "xxx@y.z",      │   │   educator:              │
│   role: "student",       │   │     ObjectId→User,       │
│   schoolId: ObjectId  ──┼┐  │   schoolId:              │
│ }                        ├─→ │     ObjectId→School,     │
│                          │   │   assignedTo: [          │
│                          │   │     ObjectId→User        │
│                          │   │   ]                      │
│                          │   │ }                        │
│                          │   └──────────────────────────┘
└──────────────────────────┘
```

---

## Transformation Logic

### Schools Mapping
```javascript
Bubble.io                  MongoDB
─────────────────────────  ──────────────────────
Name                   →   schoolName
Email                  →   email
Description            →   description
expiry date            →   expireDate
duration               →   subscription
(auto)                 →   status: "Active"
(auto)                 →   permissions: "Both"
Educator (comma-sep)   →   (used to link users)
```

### Users & Educators Mapping
```javascript
Bubble.io                  MongoDB
─────────────────────────  ──────────────────────
Name                   →   name
email                  →   email
is_educator: "yes"     →   role: "educator"
is_educator: "no"      →   role: "student"
Department             →   department
Phone                  →   phoneNumber
(random)               →   password (hashed)
(via school name)      →   schoolId (ObjectId)
```

### Students Mapping
```javascript
Bubble.io                  MongoDB
─────────────────────────  ──────────────────────
Email Address          →   user._id (creates User)
educator               →   educatorId
group                  →   school (string)
(auto)                 →   enrollmentDate
(empty)                →   assignedScenarios: []
```

### Scenarios Mapping
```javascript
Bubble.io                  MongoDB
─────────────────────────  ──────────────────────
Full JSON              →   scenarioPrompt
educator               →   educator (ObjectId)
Difficulty Level       →   difficulty
Status                 →   status
Description            →   description
AI Avatar Role         →   aiAvatarRole
(auto)                 →   schoolId (from educator)
(empty)                →   assignedTo: []
```

---

## Database Relationships

### Reference Diagram
```
School (1)
  ├─→ (1:Many) User (school_admin)
  │   └─→ User._id
  │
  └─→ (1:Many) User (educator)
      ├─→ User._id
      │
      └─→ (1:Many) Student
          ├─→ Student.educatorId (User._id)
          │
          └─→ (1:Many) Scenario
              ├─→ Scenario.educator (User._id)
              ├─→ Scenario.schoolId (School._id)
              │
              └─→ (1:Many) User (students)
                  └─→ assignedScenarios
```

### Foreign Key Structure
```
User.schoolId ──→ School._id
Student.user ──→ User._id
Student.educatorId ──→ User._id (educator)
Scenario.educator ──→ User._id (educator)
Scenario.schoolId ──→ School._id
Scenario.assignedTo[...] ──→ User._id (students)
```

---

## Import Process Flow

### Step-by-Step Execution

```
1. VALIDATION
   └─→ Check if MongoDB is connected ✓
   └─→ Validate JSON file format ✓
   └─→ Check required fields exist ✓

2. SCHOOLS MIGRATION
   └─→ Read All Schools.json
   └─→ For each school:
       └─→ Create/Update in DB
       └─→ Build schoolMap (Name → _id)

3. USERS MIGRATION
   └─→ Read All Users.json
   └─→ For each user:
       └─→ Determine role (educator vs student)
       └─→ Hash password randomly
       └─→ Link to school (if possible)
       └─→ Create/Update in DB
       └─→ Build userMap (email → {_id, role})

4. EDUCATORS MIGRATION
   └─→ Read All Educators.json
   └─→ For each educator:
       └─→ Create User if not exists
       └─→ Build educatorMap (ID → User._id)

5. STUDENTS MIGRATION
   └─→ Read All Students.json
   └─→ For each student:
       └─→ Create User if not exists
       └─→ Link to educator (via educatorId)
       └─→ Set school name/group
       └─→ Create Student record

6. SCENARIOS MIGRATION
   └─→ Read All Scenarios.json
   └─→ For each scenario:
       └─→ Find educator by ID
       └─→ Get school from educator
       └─→ Create Scenario record
       └─→ Link to educator & school

7. ERROR HANDLING
   └─→ Log all errors without stopping
   └─→ Continue with next records
   └─→ Show summary at end
```

---

## API Endpoints Architecture

### Request Flow
```
┌─────────────────┐
│  FRONTEND       │
│  (React UI)     │
└────────┬────────┘
         │
         │ FormData with files
         │ + Bearer token
         ▼
┌──────────────────────────────────┐
│  EXPRESS BACKEND                 │
│  /api/import/bulk                │
│                                  │
│  1. Check auth middleware        │
│  2. Parse files (multer)         │
│  3. Read JSON from each file     │
│  4. Transform & validate         │
│  5. Upsert to MongoDB            │
│  6. Return summary               │
└────────┬─────────────────────────┘
         │
         ▼
    MONGODB
    (Stores data)
```

### Request/Response Example
```javascript
// REQUEST
POST /api/import/bulk
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

files: All Schools.json
files: All Users.json
files: All Educators.json
files: All Students.json
files: All Scenarios.json

// RESPONSE
200 OK
{
  message: "Bulk import completed",
  summary: {
    schools: 5,
    users: 150,
    educators: 12,
    students: 500,
    scenarios: 25
  },
  errors: {
    schools: 0,
    users: 2,
    educators: 0,
    students: 5,
    scenarios: 1
  }
}
```

---

## Error Handling Strategy

```
VALIDATION ERRORS
├─→ File not found → Log & skip
├─→ Invalid JSON → Log & skip
├─→ Missing fields → Log & skip
└─→ Unique constraint violation → Upsert (update existing)

RUNTIME ERRORS
├─→ Database connection → Fail & exit
├─→ Permission denied → Return 403
├─→ Invalid token → Return 401
└─→ Parse errors → Log & continue

OUTPUT
└─→ Summary of success/failed for each entity type
└─→ Detailed error list if any failures
```

---

## Performance Considerations

### Bulk Import Speed
```
Data Size              Processing Time
─────────────────────────────────────
5 schools             < 1 second
150 users             2-3 seconds
12 educators          1 second
500 students          5-10 seconds
25 scenarios          2-3 seconds
─────────────────────────────────────
TOTAL                 10-20 seconds
```

### Optimization
- ✅ Uses MongoDB upsert (updates existing)
- ✅ Batch operations where possible
- ✅ Async/await for parallel processing
- ✅ Indexes on email (unique) for fast lookups

---

## Security Features

```
AUTHENTICATION
└─→ Bearer token required for API imports
└─→ JWT validation before processing

AUTHORIZATION
└─→ Only authenticated users can import
└─→ No public import endpoints

DATA PROTECTION
└─→ Passwords hashed with bcrypt
└─→ All sensitive data validated
└─→ Error messages don't expose system details

VALIDATION
└─→ Email format checking
└─→ Unique constraint enforcement
└─→ Schema validation before DB insert
```

---

## Deployment Checklist

- [ ] MongoDB URI configured in `.env`
- [ ] Node dependencies installed (`npm install`)
- [ ] Backend server running
- [ ] JSON files prepared (school/, user/, educator/, students/, scenario/)
- [ ] Files validated (`npm run migrate:validate`)
- [ ] MongoDB backup created (optional but recommended)
- [ ] Run migration (`npm run migrate:import`)
- [ ] Verify data in MongoDB
- [ ] Test login with imported account
- [ ] Verify relationships (educator → student → scenario)

---

## File Structure Created

```
backend/
├── scripts/
│   ├── migrateFromBubble.js      ← Main migration script
│   └── validateJsonFiles.js      ← Validation script
│
└── routes/
    └── importRoutes.js            ← API endpoints

package.json                        ← Updated with npm scripts
IMPORT_GUIDE.md                     ← Detailed documentation
MIGRATION_QUICK_START.md            ← Quick reference
IMPORT_ARCHITECTURE.md              ← This file
```

---

## Quick Reference Commands

```bash
# Validate files
npm run migrate:validate "path/to/json"

# Run migration
npm run migrate:import "path/to/json"

# Start backend (for API method)
npm run backend

# Start everything
npm run dev:both
```

---

**Architecture designed for reliability, scalability, and ease of use.** ✨
