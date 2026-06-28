/**
 * Migration Script: Bubble.io JSON → MongoDB
 * Imports Schools, Users, Educators, Students, and Scenarios
 *
 * Usage: node migrateFromBubble.js <jsonFolderPath>
 * Example: node migrateFromBubble.js "D:\downlaods\tep\tep"
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
// Import Models
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import Student from "../models/studentModel.js";
import Scenario from "../models/scenarioModel.js";

const MONGO_URI = process.env.MONGODB_URI;

// ============================================
// HELPER FUNCTIONS
// ============================================

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    process.exit(1);
  }
};

const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`✗ Error reading ${filePath}:`, error.message);
    return [];
  }
};

const TEMP_PASSWORD = "Temp@123456";

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const buildSchoolThingIdMap = (jsonFolder) => {
  const filePath = path.join(jsonFolder, "school", "All Schools.json");
  const schoolsData = readJsonFile(filePath);
  const thingIdToSchool = new Map();
  const schoolThingIds = new Map();

  for (const school of schoolsData) {
    if (!school.Educator) continue;
    const ids = school.Educator.split(",").map(id => id.trim()).filter(Boolean);
    schoolThingIds.set(school.Name, ids);
    for (const id of ids) {
      thingIdToSchool.set(id, school.Name);
    }
  }

  return { thingIdToSchool, schoolThingIds };
};

// ============================================
// MIGRATION FUNCTIONS
// ============================================

const migrateSchools = async (jsonFolder) => {
  console.log("\n📚 MIGRATING SCHOOLS...");
  const filePath = path.join(jsonFolder, "school", "All Schools.json");
  const schoolsData = readJsonFile(filePath);

  if (!schoolsData.length) {
    console.log("⚠ No schools data found");
    return new Map();
  }

  const schoolMap = new Map();
  let createdCount = 0;

  for (const schoolData of schoolsData) {
    try {
      // Skip if school name is empty
      if (!schoolData.Name || !schoolData.Email) continue;

      // Parse expiry date
      const expiryDate = new Date(
        schoolData["expiry date"] || Date.now() + 365 * 24 * 60 * 60 * 1000,
      );

      const existingSchool = await School.findOne({
        email: schoolData.Email.toLowerCase(),
      });
      if (existingSchool) {
        console.log(`  - ${schoolData.Name} (already exists)`);
        schoolMap.set(schoolData.Name, existingSchool._id.toString());
        continue;
      }

      const schoolDoc = await School.create({
        schoolName: schoolData.Name,
        description: schoolData.Description || "",
        email: schoolData.Email.toLowerCase(),
        subscription:
          schoolData.duration === "2 Year"
            ? "Subscription (6 Months)"
            : "Subscription (1 Year)",
        subscriptionType: "Premium",
        startDate: new Date(),
        expireDate: expiryDate,
        status: "Active",
        permissions: "Both",
        timeSpent: "0h",
        assignedAdmin: {
          id: null,
          name: "",
          email: schoolData.Email.toLowerCase(),
        },
      });

      schoolMap.set(schoolData.Name, schoolDoc._id.toString());
      createdCount++;
      console.log(`  ✓ ${schoolData.Name}`);
    } catch (error) {
      console.error(
        `  ✗ Failed to migrate school ${schoolData.Name}:`,
        error.message,
      );
    }
  }

  console.log(`✓ Schools migrated: ${createdCount}`);
  return schoolMap;
};

const migrateUsers = async (jsonFolder, schoolMap) => {
  console.log("\n👤 MIGRATING USERS...");
  const filePath = path.join(jsonFolder, "user", "All Users.json");
  const usersData = readJsonFile(filePath);

  if (!usersData.length) {
    console.log("⚠ No users data found");
    return new Map();
  }

  const userMap = new Map();
  let createdCount = 0;

  for (const userData of usersData) {
    try {
      if (!userData.email) continue;

      const email = userData.email.toLowerCase();
      const name = userData.Name || email.split("@")[0];

      // Determine role
      let role = "student";
      if (userData.is_educator === "yes") {
        role = "educator";
      }

      // Try to find associated school
      let schoolId = null;
      for (const [schoolName, id] of schoolMap.entries()) {
        if (
          name.toLowerCase().includes(schoolName.toLowerCase()) ||
          email.includes(schoolName.toLowerCase())
        ) {
          schoolId = id;
          break;
        }
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log(`  - ${email} (already exists)`);
        userMap.set(email, {
          id: existingUser._id.toString(),
          name: existingUser.name,
          role: existingUser.role,
          schoolId: existingUser.schoolId?.toString(),
        });
        continue;
      }

      const hashedPassword = await hashPassword(TEMP_PASSWORD);

      const userDoc = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
        schoolId: schoolId || undefined,
        phoneNumber: userData.Phone || "",
        department: userData.Department || "Science",
      });

      userMap.set(email, {
        id: userDoc._id.toString(),
        name: userDoc.name,
        role: userDoc.role,
        schoolId: userDoc.schoolId?.toString(),
      });

      createdCount++;
      console.log(`  ✓ ${name} (${role})`);
    } catch (error) {
      console.error(
        `  ✗ Failed to migrate user ${userData.email}:`,
        error.message,
      );
    }
  }

  console.log(`✓ Users migrated: ${createdCount}`);
  return userMap;
};

const migrateEducators = async (jsonFolder, userMap, schoolMap) => {
  console.log("\n🎓 MIGRATING EDUCATORS...");
  const filePath = path.join(jsonFolder, "educator", "All Educators.json");
  const educatorsData = readJsonFile(filePath);

  if (!educatorsData.length) {
    console.log("⚠ No educators data found");
    return new Map();
  }

  const educatorMap = new Map();
  let createdCount = 0;

  for (const educatorData of educatorsData) {
    try {
      if (!educatorData["Email Address"]) continue;

      const email = educatorData["Email Address"].toLowerCase();
      const name = educatorData.Name || email.split("@")[0];

      // Get or create educator user
      let user = userMap.get(email);
      if (!user) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          console.log(`  - ${name} (already exists)`);
          user = {
            id: existingUser._id.toString(),
            name: existingUser.name,
            role: "educator",
          };
          userMap.set(email, user);
        } else {
          const hashedPassword = await hashPassword(TEMP_PASSWORD);
          const userDoc = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "educator",
            department: educatorData.Department || "Science",
            phoneNumber: "",
          });

          user = {
            id: userDoc._id.toString(),
            name: userDoc.name,
            role: "educator",
          };
          userMap.set(email, user);
        }
      }

      let matchedSchoolId = null;
      for (const [schoolName, schoolId] of schoolMap.entries()) {
        if (
          email.toLowerCase().includes(schoolName.toLowerCase()) ||
          name.toLowerCase().includes(schoolName.toLowerCase())
        ) {
          matchedSchoolId = schoolId;
          break;
        }
      }
      if (matchedSchoolId) {
        await User.findByIdAndUpdate(user.id, { schoolId: matchedSchoolId });
        user.schoolId = matchedSchoolId;
      }

      educatorMap.set(educatorData.ID, user.id);
      createdCount++;
      console.log(`  ✓ ${name} (ID: ${educatorData.ID})`);
    } catch (error) {
      console.error(
        `  ✗ Failed to migrate educator ${educatorData["Email Address"]}:`,
        error.message,
      );
    }
  }

  console.log(`✓ Educators migrated: ${createdCount}`);
  return educatorMap;
};

const migrateStudents = async (jsonFolder, userMap, educatorMap, schoolMap) => {
  console.log("\n👨‍🎓 MIGRATING STUDENTS...");
  const filePath = path.join(jsonFolder, "students", "All Students.json");
  const studentsData = readJsonFile(filePath);

  if (!studentsData.length) {
    console.log("⚠ No students data found");
    return new Map();
  }

  const studentMap = new Map();
  let createdCount = 0;

  for (const studentData of studentsData) {
    try {
      if (!studentData["Email Address"]) continue;

      const email = studentData["Email Address"].toLowerCase();
      const name = email.split("@")[0];

      // Get or create student user
      let user = userMap.get(email);
      if (!user) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          console.log(`  - ${email} (already exists)`);
          user = {
            id: existingUser._id.toString(),
            name: existingUser.name,
            role: "student",
          };
          userMap.set(email, user);
        } else {
          const hashedPassword = await hashPassword(TEMP_PASSWORD);
          const userDoc = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "student",
            phoneNumber: "",
          });

          user = {
            id: userDoc._id.toString(),
            name: userDoc.name,
            role: "student",
          };
          userMap.set(email, user);
        }
      }

      // Only use visible direct connection: educatorMap short ID lookup
      let educatorId = null;
      if (studentData.educator) {
        educatorId = educatorMap.get(studentData.educator);
      }

      const existingStudent = await Student.findOne({ user: user.id });
      if (existingStudent) {
        console.log(`  - ${name} (student record already exists)`);
        studentMap.set(email, existingStudent._id.toString());
        continue;
      }

      // Assign schoolId to student User from educator
      let schoolIdOnUser = null;
      if (educatorId) {
        const educatorUser = await User.findById(educatorId).lean();
        if (educatorUser && educatorUser.schoolId) {
          schoolIdOnUser = educatorUser.schoolId.toString();
          await User.findByIdAndUpdate(user.id, { schoolId: educatorUser.schoolId });
          user.schoolId = schoolIdOnUser;
        }
      }

      const studentDoc = await Student.create({
        user: user.id,
        educatorId: educatorId || undefined,
        grade: studentData.grade || "",
        school: studentData.group || "",
        enrollmentDate: new Date(),
        assignedScenarios: [],
      });

      studentMap.set(email, studentDoc._id.toString());
      createdCount++;
      console.log(`  ✓ ${name} (Group: ${studentData.group || "N/A"})`);
      if (educatorId) console.log(`    → Educator linked`);
      if (schoolIdOnUser) console.log(`    → SchoolId set on user`);
    } catch (error) {
      console.error(
        `  ✗ Failed to migrate student ${studentData["Email Address"]}:`,
        error.message,
      );
    }
  }

  console.log(`✓ Students migrated: ${createdCount}`);
  return studentMap;
};

const assignSchoolAdmins = async (userMap, schoolMap) => {
  console.log("\n🔐 ASSIGNING SCHOOL ADMINS...");
  let updatedCount = 0;
  const noAdmin = [];

  try {
    for (const [schoolName, schoolId] of schoolMap.entries()) {
      const school = await School.findById(schoolId);
      if (school.assignedAdmin?.id) {
        console.log(`  - ${schoolName} (already has admin)`);
        updatedCount++;
        continue;
      }

      let adminUser = await User.findOne({ role: "school_admin", schoolId });
      if (!adminUser) {
        adminUser = await User.findOne({ role: "educator", schoolId });
      }

      if (adminUser) {
        await School.findByIdAndUpdate(schoolId, {
          assignedAdmin: {
            id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
          },
        });
        updatedCount++;
        console.log(`  ✓ ${adminUser.email} assigned as admin to ${schoolName}`);
      } else {
        noAdmin.push(schoolName);
      }
    }
  } catch (error) {
    console.error(`  ✗ Error assigning admins:`, error.message);
  }

  if (noAdmin.length > 0) {
    console.log(`  ⚠ No existing admin user found for: ${noAdmin.join(", ")}`);
  }
  console.log(`✓ School admins assigned: ${updatedCount}`);
};

const linkEducatorsWithoutSchool = async (userMap, schoolMap) => {
  console.log("\n🔗 LINKING EDUCATORS WITHOUT SCHOOL...");
  let linkedCount = 0;
  const stillOrphaned = [];

  try {
    const schools = await School.find({}).lean();
    const educators = await User.find({ role: "educator", schoolId: null });

    for (const educator of educators) {
      let matchedSchool = null;

      // Priority 1: educator's email matches a school_admin → use that admin's school
      const adminUser = await User.findOne({ role: "school_admin", email: educator.email });
      if (adminUser && adminUser.schoolId) {
        const school = schools.find(s => s._id.toString() === adminUser.schoolId.toString());
        if (school) {
          matchedSchool = school;
          console.log(`  → via school_admin ${educator.email}`);
        }
      }

      // Priority 2: Match by exact email
      if (!matchedSchool) {
        matchedSchool = schools.find(s => s.email === educator.email);
      }

      // Priority 3: Match by name/email containing school name
      if (!matchedSchool) {
        matchedSchool = schools.find(s =>
          educator.name.toLowerCase().includes(s.schoolName.toLowerCase()) ||
          educator.email.toLowerCase().includes(s.schoolName.toLowerCase())
        );
      }

      if (matchedSchool) {
        educator.schoolId = matchedSchool._id;
        await educator.save();
        linkedCount++;
        console.log(`  ✓ ${educator.email} → ${matchedSchool.schoolName}`);
      } else {
        stillOrphaned.push(educator.email);
      }
    }
  } catch (error) {
    console.error(`  ✗ Error linking educators:`, error.message);
  }

  if (stillOrphaned.length > 0) {
    console.log(`  ⚠ Still orphaned: ${stillOrphaned.join(", ")}`);
  }
  console.log(`✓ Educators linked: ${linkedCount}`);
};

const migrateScenarios = async (jsonFolder, educatorMap, schoolMap) => {
  console.log("\n🎬 MIGRATING SCENARIOS...");
  const filePath = path.join(jsonFolder, "scenario", "All Scenarios.json");
  const scenariosData = readJsonFile(filePath);

  if (!scenariosData.length) {
    console.log("⚠ No scenarios data found");
    return;
  }

  let createdCount = 0;

  for (const scenarioData of scenariosData) {
    try {
      // Skip if name is empty or looks like invalid data
      if (!scenarioData.Full || scenarioData.Full === "Unsupported Scenario")
        continue;

      // Extract scenario name from Full JSON or use default
      let scenarioName = "Clinical Scenario";
      if (scenarioData.Full && typeof scenarioData.Full === "string") {
        const match = scenarioData.Full.match(/"scenario_name":"([^"]+)"/);
        if (match) scenarioName = match[1];
      }

      // Get educator - use first from the list if available
      let educatorId = null;
      if (scenarioData.educator) {
        educatorId = educatorMap.get(scenarioData.educator);
      }

      // Get first school ID as fallback
      let schoolId = null;
      for (const [, id] of schoolMap.entries()) {
        schoolId = id;
        break;
      }

      if (!educatorId || !schoolId) continue;

      const existingScenario = await Scenario.findOne({
        scenarioName,
        educator: educatorId,
        schoolId,
      });
      if (existingScenario) {
        console.log(`  - ${scenarioName} (already exists)`);
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
      console.log(`  ✓ ${scenarioName}`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate scenario:`, error.message);
    }
  }

  console.log(`✓ Scenarios migrated: ${createdCount}`);
};

// ============================================
// MAIN MIGRATION
// ============================================

const main = async () => {
  const jsonFolder = process.argv[2];

  if (!jsonFolder) {
    console.error("❌ Usage: node migrateFromBubble.js <jsonFolderPath>");
    console.error(
      "Example: node migrateFromBubble.js 'D:\\downlaods\\tep\\tep'",
    );
    process.exit(1);
  }

  if (!fs.existsSync(jsonFolder)) {
    console.error(`❌ Folder not found: ${jsonFolder}`);
    process.exit(1);
  }

  try {
    console.log("🚀 STARTING MIGRATION FROM BUBBLE.IO...");
    console.log(`📁 Source folder: ${jsonFolder}`);
    console.log(`🔗 MongoDB: ${MONGO_URI}`);

    await connectDB();

    // Execute migrations in order
    const schoolMap = await migrateSchools(jsonFolder);
    const userMap = await migrateUsers(jsonFolder, schoolMap);
    const educatorMap = await migrateEducators(jsonFolder, userMap, schoolMap);
    await assignSchoolAdmins(userMap, schoolMap);
    await linkEducatorsWithoutSchool(userMap, schoolMap);
    const studentMap = await migrateStudents(
      jsonFolder,
      userMap,
      educatorMap,
      schoolMap,
    );
    await migrateScenarios(jsonFolder, educatorMap, schoolMap);

    console.log("\n✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log(`📊 Summary:`);
    console.log(`   - Schools: ${schoolMap.size}`);
    console.log(`   - Users: ${userMap.size}`);
    console.log(`   - Educators: ${educatorMap.size}`);
    console.log(`   - Students: ${studentMap.size}`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
};

main();
