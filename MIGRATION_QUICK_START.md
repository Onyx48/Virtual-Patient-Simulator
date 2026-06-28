# 🚀 Data Import - Quick Start Guide

## Files Created

✅ **Migration Script**: `backend/scripts/migrateFromBubble.js`
✅ **API Routes**: `backend/routes/importRoutes.js`
✅ **Validator**: `backend/scripts/validateJsonFiles.js`
✅ **Full Guide**: `IMPORT_GUIDE.md`

---

## 3-Minute Setup

### Step 1: Validate Your JSON Files
```bash
npm run migrate:validate "D:\downlaods\tep\tep"
```

Expected output:
```
✅ school/All Schools.json (5 records)
✅ user/All Users.json (150 records)
✅ educator/All Educators.json (12 records)
✅ students/All Students.json (500 records)
✅ scenario/All Scenarios.json (25 records)
```

### Step 2: Run Migration
```bash
npm run migrate:import "D:\downlaods\tep\tep"
```

Expected output:
```
✅ MIGRATION COMPLETED SUCCESSFULLY!
   - Schools: 5
   - Users: 150
   - Educators: 12
   - Students: 500
```

### Step 3: Verify
- Login to your app with any imported account
- Check database in MongoDB Atlas/Compass
- Verify school admin can see educators
- Check educators can see students

---

## Two Methods to Import

### ✅ Method 1: Script (Recommended for bulk import)
```bash
npm run migrate:import "path/to/json/folder"
```
**Pros**: Fast, reliable, no UI needed
**Cons**: Command line only

### ✅ Method 2: API (Recommended for UI)

1. Start backend:
```bash
npm run backend
```

2. Upload files via API:
```javascript
// Using curl
curl -X POST http://localhost:5001/api/import/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@All Schools.json" \
  -F "files=@All Users.json" \
  -F "files=@All Educators.json" \
  -F "files=@All Students.json" \
  -F "files=@All Scenarios.json"
```

3. Or use a UI component (see `IMPORT_GUIDE.md`)

---

## What Gets Imported

| From | To | Mapping |
|---|---|---|
| **All Schools.json** | Schools | Name → schoolName, Email → email |
| **All Users.json** | Users | is_educator → role, Name → name |
| **All Educators.json** | Users | Email → email (educator role) |
| **All Students.json** | Students + Users | Email → user, educator → educatorId |
| **All Scenarios.json** | Scenarios | Full JSON → scenarioPrompt |

---

## Troubleshooting

### ❌ "MONGODB_URI not found"
- Check `.env` file in `backend/` folder
- Should have: `MONGODB_URI=mongodb://localhost:27017/vps`

### ❌ "Cannot find module mongoose"
```bash
npm install
```

### ❌ "File not found"
- Check path is correct: `"D:\downlaods\tep\tep"`
- Ensure folder contains `school/`, `user/`, `educator/`, etc.

### ❌ "Invalid JSON"
- Files must be valid JSON (use online validator)
- Check encoding is UTF-8
- No trailing commas in arrays

---

## File Structure Required

```
your-json-folder/
├── school/
│   └── All Schools.json
├── user/
│   └── All Users.json
├── educator/
│   └── All Educators.json
├── students/
│   └── All Students.json
└── scenario/
    └── All Scenarios.json
```

---

## After Import

1. **First Login**
   - Use any imported email
   - Password: Check terminal output or reset
   - (For security: all users get random passwords)

2. **Verify Relationships**
   ```bash
   # In MongoDB
   db.users.findOne({ role: "educator" })
   # Should have valid schoolId
   
   db.students.findOne()
   # Should have valid educatorId
   ```

3. **Test Workflow**
   - ✅ Admin logs in
   - ✅ Creates/assigns educators
   - ✅ Educators see students
   - ✅ Students see scenarios

---

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| Import is slow | Normal for 500+ records. Let it run. |
| Some users failed | Check if emails are unique in source data |
| Students not linked | Verify educator field in Students.json |
| Scenarios not showing | Check educator exists and school_id is set |

---

## Next Steps

1. **Read Full Guide**: `IMPORT_GUIDE.md` for detailed info
2. **Check Logs**: Look at terminal output during import
3. **Test Features**: Try logging in as different roles
4. **Monitor**: Use MongoDB Compass to view imported data

---

## Need Help?

1. Check `IMPORT_GUIDE.md` for detailed documentation
2. Review error messages in terminal
3. Verify JSON files are valid
4. Check MongoDB connection

---

## NPM Commands

```bash
# Validate files before importing
npm run migrate:validate "path/to/json"

# Run migration
npm run migrate:import "path/to/json"

# Show help
npm run migrate:help

# Start backend (for API method)
npm run backend

# Start both frontend + backend
npm run dev:both
```

---

**You're all set! 🎉**

Run validation first, then import. Done in minutes!
