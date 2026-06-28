import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Scenario from "../models/scenarioModel.js";

const MONGO_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB");
};

// ============================================================
// CONFIGURATION
// ============================================================

const SIT_SCHOOL_ID = "6a342fcef6b95317a692ded8";
const BENJAMIN_EMAIL = "benjamindemo@email.com";

// ============================================================
// STEP 1: Set supervisor on all SIT students → Benjamin
// ============================================================

const setSupervisors = async () => {
  console.log("\n📌 STEP 1: Setting Benjamin as supervisor for all SIT students...");

  const benjamin = await User.findOne({ email: BENJAMIN_EMAIL });
  if (!benjamin) {
    console.error(`  ❌ Benjamin not found (${BENJAMIN_EMAIL})`);
    return 0;
  }
  console.log(`  Found Benjamin: ${benjamin.name} (${benjamin._id})`);

  const sitStudents = await User.find({
    role: "student",
    email: /sit\.singaporetech\.edu\.sg$/i,
  });

  console.log(`  Found ${sitStudents.length} SIT students`);

  let updatedCount = 0;
  let skipCount = 0;

  for (const student of sitStudents) {
    if (student.supervisor && student.supervisor.toString() === benjamin._id.toString()) {
      skipCount++;
      continue;
    }
    student.supervisor = benjamin._id;
    await student.save();
    updatedCount++;
  }

  console.log(`  → Done: ${updatedCount} updated, ${skipCount} already set`);
  return updatedCount;
};

// ============================================================
// STEP 2: Randomly assign 1-4 scenarios to each student
// ============================================================

const randomlyAssignScenarios = async () => {
  console.log("\n📌 STEP 2: Randomly assigning scenarios to students...");

  const scenarios = await Scenario.find({
    schoolId: SIT_SCHOOL_ID,
  }).select("_id scenarioName");

  console.log(`  Available scenarios: ${scenarios.length}`);
  for (const s of scenarios) {
    console.log(`    - ${s.scenarioName.substring(0, 60)} (${s._id})`);
  }

  const students = await User.find({
    role: "student",
    email: /sit\.singaporetech\.edu\.sg$/i,
  }).select("_id email name");

  console.log(`\n  Total students to assign: ${students.length}`);

  // Clear existing assignments on these scenarios first
  for (const scenario of scenarios) {
    scenario.assignedTo = [];
    await scenario.save();
  }
  console.log("  Cleared existing assignments on all scenarios");

  // Track stats
  const scenarioAssignCounts = {};
  for (const s of scenarios) {
    scenarioAssignCounts[s._id.toString()] = 0;
  }

  const studentAssignmentCounts = {};

  for (const student of students) {
    const numScenarios = Math.floor(Math.random() * 4) + 1; // 1-4

    // Shuffle scenarios and pick first numScenarios
    const shuffled = [...scenarios].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numScenarios);

    for (const scenario of selected) {
      if (!scenario.assignedTo.includes(student._id)) {
        scenario.assignedTo.push(student._id);
        scenarioAssignCounts[scenario._id.toString()]++;
      }
    }

    studentAssignmentCounts[student._id.toString()] = selected.length;
  }

  // Save all scenarios
  for (const scenario of scenarios) {
    await scenario.save();
  }

  // Statistics
  console.log("\n  📊 Assignment Summary:");
  for (const scenario of scenarios) {
    const count = scenario.assignedTo.length;
    console.log(`    "${scenario.scenarioName.substring(0, 50)}..." → ${count} students`);
  }

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const count of Object.values(studentAssignmentCounts)) {
    dist[count] = (dist[count] || 0) + 1;
  }
  console.log(`\n  📊 Student distribution (scenarios per student):`);
  console.log(`    1 scenario:  ${dist[1]} students`);
  console.log(`    2 scenarios: ${dist[2]} students`);
  console.log(`    3 scenarios: ${dist[3]} students`);
  console.log(`    4 scenarios: ${dist[4]} students`);

  return students.length;
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  console.log("=".repeat(60));
  console.log("  ASSIGN SIT STUDENTS TO SCENARIOS");
  console.log("=".repeat(60));

  try {
    await connectDB();

    const updated = await setSupervisors();
    if (updated === 0) {
      console.log("\n⚠ No students updated. Skipping scenario assignment.");
    } else {
      await randomlyAssignScenarios();
    }

    console.log("\n" + "=".repeat(60));
    console.log("  ✅ ASSIGNMENT COMPLETE");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
};

main();
