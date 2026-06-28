# 📊 Data Import Guide - Bubble.io to MongoDB

This guide explains how to import your data from Bubble.io JSON exports to MongoDB using two methods:
1. **Standalone Migration Script** (Recommended for bulk data)
2. **API Endpoints** (Recommended for selective imports via UI)

---

## 📋 Prerequisites

- Node.js installed
- MongoDB running and configured in `.env`
- Your JSON export files from Bubble.io

### Required JSON Files Structure
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

## 🚀 Method 1: Standalone Migration Script

### Best For:
- Large bulk imports
- First-time data migration
- No UI interaction needed
- Batch operations

### Setup

1. **Update `.env` file** (if needed):
```env
MONGODB_URI=mongodb://localhost:27017/vps
```

2. **Verify MongoDB is running**:
```bash
# Test connection
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI)"
```

### Usage

```bash
# Run migration script
node backend/scripts/migrateFromBubble.js "D:\downlaods\tep\tep"
```

### Example Output
```
🚀 STARTING MIGRATION FROM BUBBLE.IO...
📁 Source folder: D:\downlaods\tep\tep
🔗 MongoDB: mongodb://localhost:27017/vps

✓ Connected to MongoDB

📚 MIGRATING SCHOOLS...
  ✓ SIT
  ✓ Oxford School
  ✓ Test University
✓ Schools migrated: 3

👤 MIGRATING USERS...
  ✓ Admin Kapil (student)
  ✓ Kapil School Owner (educator)
  ✓ Kapil Student (student)
✓ Users migrated: 150+

🎓 MIGRATING EDUCATORS...
  ✓ Benjamin (ID: N89S6YU0)
  ✓ Education Master (ID: OAENTE8O)
✓ Educators migrated: 12

👨‍🎓 MIGRATING STUDENTS...
  ✓ student1 (Group: MSK CPE)
  ✓ student2 (Group: MSK2)
✓ Students migrated: 500+

🎬 MIGRATING SCENARIOS...
  ✓ Clinical Scenario 1
  ✓ Frozen Shoulder Case
✓ Scenarios migrated: 25+

✅ MIGRATION COMPLETED SUCCESSFULLY!
📊 Summary:
   - Schools: 5
   - Users: 150
   - Educators: 12
   - Students: 500

🔌 Database connection closed
```

### Script Features

✅ **Automatic Role Detection**
- `is_educator: "yes"` → `role: "educator"`
- `is_educator: "no"` → `role: "student"`

✅ **School Linking**
- Automatically links users to schools when possible
- Creates mappings for relationships

✅ **Duplicate Handling**
- Uses `upsert` to avoid duplicates
- Updates existing records if email matches

✅ **Error Handling**
- Logs all errors without stopping
- Continues processing remaining records
- Shows error summary at end

✅ **Password Management**
- Generates random passwords for all imported users
- All passwords are hashed with bcrypt

### Troubleshooting Script Issues

#### Problem: "Cannot find module" error
```bash
# Make sure you're in the backend directory
cd backend
node scripts/migrateFromBubble.js "path/to/json"
```

#### Problem: "MONGODB_URI not found"
- Check `.env` file exists in backend root
- Ensure `MONGODB_URI` is defined
- Test with: `echo $MONGODB_URI`

#### Problem: "JSON parse error"
- Verify JSON files are valid
- Use online JSON validator on a sample file
- Check file encoding is UTF-8

---

## 🌐 Method 2: API Endpoints

### Best For:
- Selective imports
- UI-based bulk import
- Testing specific data types
- Gradual data migration

### Setup

1. **Start your backend server**:
```bash
npm run dev
# or
node backend/index.js
```

2. **Server should respond to**:
```
GET http://localhost:5001/api/import/status
```

### Available Endpoints

#### 1. Check Import Status
```http
GET /api/import/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Import service is running",
  "availableEndpoints": [
    "POST /api/import/schools - Import schools JSON",
    "POST /api/import/bulk - Bulk import all JSON files"
  ]
}
```

#### 2. Import Schools Only
```http
POST /api/import/schools
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: All Schools.json
```

**Response:**
```json
{
  "message": "Imported 5 schools",
  "createdCount": 5,
  "errors": [
    "Skipped invalid school: "
  ]
}
```

#### 3. Bulk Import Everything
```http
POST /api/import/bulk
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: All Schools.json
files: All Users.json
files: All Educators.json
files: All Students.json
files: All Scenarios.json
```

**Response:**
```json
{
  "message": "Bulk import completed",
  "summary": {
    "schools": 5,
    "users": 150,
    "educators": 12,
    "students": 500,
    "scenarios": 25
  },
  "errors": {
    "schools": 0,
    "users": 2,
    "educators": 0,
    "students": 5,
    "scenarios": 1
  }
}
```

### Frontend Example (React)

```javascript
// Single file upload
const uploadSchools = async (file, token) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:5001/api/import/schools", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  return await response.json();
};

// Bulk upload
const bulkUpload = async (files, token) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch("http://localhost:5001/api/import/bulk", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  return await response.json();
};

// Usage
const handleImport = async (selectedFiles) => {
  const token = localStorage.getItem("token");
  const result = await bulkUpload(selectedFiles, token);
  console.log("Import result:", result);
};
```

### Creating an Import UI Component

```jsx
import React, { useState } from "react";

export default function BulkImport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("http://localhost:5001/api/import/bulk", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Bulk Import Data</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          multiple
          accept=".json"
          onChange={handleFileChange}
          className="mb-4"
        />

        <button
          type="submit"
          disabled={loading || files.length === 0}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Import Summary</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Data Mapping Reference

### Schools
| Bubble.io Field | MongoDB Field | Type | Notes |
|---|---|---|---|
| Name | schoolName | String | Required |
| Email | email | String | Required, unique |
| Description | description | String | Optional |
| expiry date | expireDate | Date | Calculated if missing |
| duration | subscription | String | "1 Year" or "6 Months" |

### Users
| Bubble.io Field | MongoDB Field | Type | Notes |
|---|---|---|---|
| Name | name | String | Required |
| email | email | String | Required, unique |
| is_educator | role | String | "educator" or "student" |
| Phone | phoneNumber | String | Optional |
| Department | department | String | Science, History, etc. |

### Students
| Bubble.io Field | MongoDB Field | Type | Notes |
|---|---|---|---|
| Email Address | user (ref) | ObjectId | Links to User |
| educator | educatorId | ObjectId | Links to Educator User |
| group | school | String | Class/group name |

### Scenarios
| Bubble.io Field | MongoDB Field | Type | Notes |
|---|---|---|---|
| Full JSON | scenarioPrompt | String | Full scenario details |
| educator | educator | ObjectId | Links to Educator User |
| Difficulty Level | difficulty | String | Easy, Medium, Hard |
| Status | status | String | Draft, Published, etc. |

---

## ✅ Verification Checklist

After import, verify your data:

```javascript
// Check MongoDB directly
db.schools.countDocuments() // Should match imported count
db.users.countDocuments()
db.students.countDocuments()
db.scenarios.countDocuments()

// Check relationships
db.users.findOne({ role: "educator" })
// Should have valid schoolId reference

db.students.findOne()
// Should have valid educatorId reference
```

### In Your Application

1. ✅ Login with imported user account
2. ✅ Verify school appears in dashboard
3. ✅ Check educators can see assigned students
4. ✅ Verify scenarios are assigned correctly
5. ✅ Test student enrollment

---

## 🔧 Advanced Options

### Custom Password Generation

Edit `migrateFromBubble.js` or `importRoutes.js`:

```javascript
// Instead of random password, set specific one
const password = "DefaultPassword@123"; // Change this
```

### Resume Failed Imports

The API endpoints have error tracking. Check response:

```json
{
  "errors": {
    "students": 5,  // 5 students failed
    "scenarios": 1
  }
}
```

### Partial Data Import

Only import specific files (skip Scenarios if not needed):

```bash
# Script: Manual edit and run separately
node backend/scripts/migrateFromBubble.js "path" schools-only

# API: Upload only certain files
# Upload only All Schools.json and All Users.json
```

---

## 📝 Logs & Debugging

### Script Logs
- Check console output directly
- Save to file: `node script.js > migration.log 2>&1`

### API Logs
- Check backend console
- Monitor MongoDB with: `mongosh` shell
- Check `/uploads/imports/` folder for uploaded files

---

## ⚠️ Important Notes

1. **Backup MongoDB** before importing
   ```bash
   mongodump --db vps --out backup-2024-06-16
   ```

2. **Test with sample data first** - Import only 1 school initially

3. **Verify email uniqueness** - Check Bubble data for duplicate emails

4. **Role Assignment** - Verify is_educator field is correct in source data

5. **Password Reset** - All imported users should reset passwords on first login

---

## 🆘 Support

If you encounter issues:

1. Check MongoDB connection
2. Verify JSON file format
3. Check user permissions (need to be authenticated for API)
4. Review error messages in console
5. Check file uploads in `/uploads/imports/`

---

## 🎯 Next Steps

After import:

1. ✅ Create super admin account (if not imported)
2. ✅ Set up school admin accounts
3. ✅ Assign educators to schools
4. ✅ Assign students to educators
5. ✅ Assign scenarios to students
6. ✅ Test complete workflow

---

**Happy importing! 🚀**
