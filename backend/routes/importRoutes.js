/**
 * Import/Bulk Upload Routes
 * Provides API endpoints for importing data from JSON files
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import Student from "../models/studentModel.js";
import Scenario from "../models/scenarioModel.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/imports";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /json/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === "application/json";

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only JSON files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: fileFilter,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const generatePassword = () => crypto.randomBytes(8).toString("hex");

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const parseJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============================================
// IMPORT FUNCTIONS
// ============================================

const importSchools = async (schoolsData) => {
  const schoolMap = new Map();
  let createdCount = 0;
  let errors = [];

  for (const schoolData of schoolsData) {
    try {
      if (!schoolData.Name || !schoolData.Email) {
        errors.push(`Skipped invalid school: ${schoolData.Name}`);
        continue;
      }

      const expiryDate = new Date(schoolData["expiry date"] || Date.now() + 365 * 24 * 60 * 60 * 1000);

      const existingSchool = await School.findOne({ email: schoolData.Email.toLowerCase() });
      if (existingSchool) {
        schoolMap.set(schoolData.Name, existingSchool._id.toString());
        createdCount++;
        continue;
      }

      const schoolDoc = await School.create({
        schoolName: schoolData.Name,
        description: schoolData.Description || "",
        email: schoolData.Email.toLowerCase(),
        subscription: schoolData.duration === "2 Year" ? "Subscription (6 Months)" : "Subscription (1 Year)",
        subscriptionType: "Premium",
        startDate: new Date(),
        expireDate: expiryDate,
        status: "Active",
        permissions: "Both",
      });

      schoolMap.set(schoolData.Name, schoolDoc._id.toString());
      createdCount++;
    } catch (error) {
      errors.push(`School ${schoolData.Name}: ${error.message}`);
    }
  }

  return { createdCount, errors, schoolMap };
};

const importUsers = async (usersData, schoolMap) => {
  const userMap = new Map();
  let createdCount = 0;
  let errors = [];

  for (const userData of usersData) {
    try {
      if (!userData.email) continue;

      const email = userData.email.toLowerCase();
      const name = userData.Name || email.split("@")[0];
      let role = userData.is_educator === "yes" ? "educator" : "student";

      let schoolId = null;
      for (const [schoolName, id] of schoolMap.entries()) {
        if (name.toLowerCase().includes(schoolName.toLowerCase()) ||
            email.includes(schoolName.toLowerCase())) {
          schoolId = id;
          break;
        }
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        userMap.set(email, {
          id: existingUser._id.toString(),
          name: existingUser.name,
          role: existingUser.role,
        });
        createdCount++;
        continue;
      }

      const plainPassword = generatePassword();
      const hashedPassword = await hashPassword(plainPassword);

      const userDoc = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
        schoolId: schoolId || undefined,
        phoneNumber: userData.Phone || "",
        department: userData.Department || "Science",
      });

      try {
        await sendWelcomeEmail({ toEmail: email, name, password: plainPassword });
      } catch (emailErr) {
        console.error("[IMPORT] Failed to send welcome email for:", email, emailErr);
      }

      userMap.set(email, {
        id: userDoc._id.toString(),
        name: userDoc.name,
        role: userDoc.role,
      });

      createdCount++;
    } catch (error) {
      errors.push(`User ${userData.email}: ${error.message}`);
    }
  }

  return { createdCount, errors, userMap };
};

const importEducators = async (educatorsData, userMap) => {
  const educatorMap = new Map();
  let createdCount = 0;
  let errors = [];

  for (const educatorData of educatorsData) {
    try {
      if (!educatorData["Email Address"]) continue;

      const email = educatorData["Email Address"].toLowerCase();
      const name = educatorData.Name || email.split("@")[0];

      let user = userMap.get(email);
      if (!user) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          user = {
            id: existingUser._id.toString(),
            name: existingUser.name,
            role: "educator",
          };
          userMap.set(email, user);
        } else {
          const plainPassword = generatePassword();
          const hashedPassword = await hashPassword(plainPassword);
          const userDoc = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "educator",
            department: educatorData.Department || "Science",
          });

          try {
            await sendWelcomeEmail({ toEmail: email, name, password: plainPassword });
          } catch (emailErr) {
            console.error("[IMPORT] Failed to send welcome email for:", email, emailErr);
          }

          user = {
            id: userDoc._id.toString(),
            name: userDoc.name,
            role: "educator",
          };
          userMap.set(email, user);
        }
      }

      educatorMap.set(educatorData.ID, user.id);
      createdCount++;
    } catch (error) {
      errors.push(`Educator ${educatorData["Email Address"]}: ${error.message}`);
    }
  }

  return { createdCount, errors, educatorMap };
};

const importStudents = async (studentsData, userMap, educatorMap, schoolMap) => {
  const studentMap = new Map();
  let createdCount = 0;
  let errors = [];

  for (const studentData of studentsData) {
    try {
      if (!studentData["Email Address"]) continue;

      const email = studentData["Email Address"].toLowerCase();
      const name = email.split("@")[0];

      let user = userMap.get(email);
      if (!user) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          user = {
            id: existingUser._id.toString(),
            name: existingUser.name,
            role: "student",
          };
          userMap.set(email, user);
        } else {
          const plainPassword = generatePassword();
          const hashedPassword = await hashPassword(plainPassword);
          const userDoc = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "student",
            phoneNumber: "",
          });

          try {
            await sendWelcomeEmail({ toEmail: email, name, password: plainPassword });
          } catch (emailErr) {
            console.error("[IMPORT] Failed to send welcome email for:", email, emailErr);
          }

          user = {
            id: userDoc._id.toString(),
            name: userDoc.name,
            role: "student",
          };
          userMap.set(email, user);
        }
      }

      let educatorId = null;
      if (studentData.educator) {
        educatorId = educatorMap.get(studentData.educator) || studentData.educator;
      }

      let schoolId = null;
      for (const [schoolName, id] of schoolMap.entries()) {
        if (studentData.group?.includes(schoolName)) {
          schoolId = schoolName;
          break;
        }
      }

      const existingStudent = await Student.findOne({ user: user.id });
      if (existingStudent) {
        createdCount++;
        continue;
      }

      await Student.create({
        user: user.id,
        educatorId: educatorId || undefined,
        grade: studentData.grade || "",
        school: schoolId || studentData.group || "",
        enrollmentDate: new Date(),
        assignedScenarios: [],
      });

      createdCount++;
    } catch (error) {
      errors.push(`Student ${studentData["Email Address"]}: ${error.message}`);
    }
  }

  return { createdCount, errors, studentMap };
};

const importScenarios = async (scenariosData, educatorMap, schoolMap) => {
  let createdCount = 0;
  let errors = [];

  for (const scenarioData of scenariosData) {
    try {
      if (!scenarioData.Full || scenarioData.Full === "Unsupported Scenario") continue;

      let scenarioName = "Clinical Scenario";
      if (scenarioData.Full && typeof scenarioData.Full === "string") {
        const match = scenarioData.Full.match(/"scenario_name":"([^"]+)"/);
        if (match) scenarioName = match[1];
      }

      let educatorId = null;
      if (scenarioData.educator) {
        educatorId = educatorMap.get(scenarioData.educator);
      }

      let schoolId = null;
      for (const [, id] of schoolMap.entries()) {
        schoolId = id;
        break;
      }

      if (!educatorId || !schoolId) {
        errors.push(`Scenario ${scenarioName}: Missing educator or school`);
        continue;
      }

      const existingScenario = await Scenario.findOne({
        scenarioName,
        educator: educatorId,
        schoolId
      });
      if (existingScenario) {
        createdCount++;
        continue;
      }

      await Scenario.create({
        scenarioName,
        description: scenarioData.Description || "Imported from Bubble.io",
        educator: educatorId,
        schoolId: schoolId,
        status: scenarioData.Status || "Draft",
        permissions: "Both",
        difficulty: scenarioData["Difficulty Level"] || "Medium",
        scenarioPrompt: scenarioData.Full || "",
        aiAvatarRole: scenarioData["AI Avatar Role"] || "",
        template: "medical",
      });

      createdCount++;
    } catch (error) {
      errors.push(`Scenario: ${error.message}`);
    }
  }

  return { createdCount, errors };
};

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/import/schools
 * Upload and import schools JSON
 */
router.post("/schools", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = parseJsonFile(req.file.path);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid JSON file", error: result.error });
    }

    const { createdCount, errors } = await importSchools(result.data);

    res.status(200).json({
      message: `Imported ${createdCount} schools`,
      createdCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: "Import failed", error: error.message });
  }
});

/**
 * POST /api/import/bulk
 * Bulk import all data (Schools, Users, Educators, Students, Scenarios)
 * Expects formData with multiple files
 */
router.post("/bulk", protect, upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const results = {
      schools: { createdCount: 0, errors: [] },
      users: { createdCount: 0, errors: [] },
      educators: { createdCount: 0, errors: [] },
      students: { createdCount: 0, errors: [] },
      scenarios: { createdCount: 0, errors: [] },
    };

    const maps = {
      schoolMap: new Map(),
      userMap: new Map(),
      educatorMap: new Map(),
      studentMap: new Map(),
    };

    // Process files
    for (const file of req.files) {
      const parsed = parseJsonFile(file.path);
      if (!parsed.success) continue;

      // Determine file type and process accordingly
      const fileName = file.originalname.toLowerCase();

      if (fileName.includes("school")) {
        const result = await importSchools(parsed.data);
        results.schools = result;
        maps.schoolMap = result.schoolMap;
      } else if (fileName.includes("user")) {
        const result = await importUsers(parsed.data, maps.schoolMap);
        results.users = result;
        maps.userMap = result.userMap;
      } else if (fileName.includes("educator")) {
        const result = await importEducators(parsed.data, maps.userMap);
        results.educators = result;
        maps.educatorMap = result.educatorMap;
      } else if (fileName.includes("student")) {
        const result = await importStudents(parsed.data, maps.userMap, maps.educatorMap, maps.schoolMap);
        results.students = result;
        maps.studentMap = result.studentMap;
      } else if (fileName.includes("scenario")) {
        const result = await importScenarios(parsed.data, maps.educatorMap, maps.schoolMap);
        results.scenarios = result;
      }
    }

    res.status(200).json({
      message: "Bulk import completed",
      summary: {
        schools: results.schools.createdCount,
        users: results.users.createdCount,
        educators: results.educators.createdCount,
        students: results.students.createdCount,
        scenarios: results.scenarios.createdCount,
      },
      errors: {
        schools: results.schools.errors?.length || 0,
        users: results.users.errors?.length || 0,
        educators: results.educators.errors?.length || 0,
        students: results.students.errors?.length || 0,
        scenarios: results.scenarios.errors?.length || 0,
      },
    });

    // Cleanup uploaded files
    req.files.forEach((file) => {
      fs.unlink(file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Bulk import failed", error: error.message });
  }
});

/**
 * GET /api/import/status
 * Check import status
 */
router.get("/status", protect, (req, res) => {
  res.status(200).json({
    message: "Import service is running",
    availableEndpoints: [
      "POST /api/import/schools - Import schools JSON",
      "POST /api/import/bulk - Bulk import all JSON files",
    ],
  });
});

export default router;
