import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
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

const EDUCATORS = [
  { email: "teacher@school.com", label: "John Teacher" },
  { email: "rntayllor@gmail.com", label: "Kapil School Owner" },
  { email: "benjamindemo@email.com", label: "Benjamin" },
  { email: "testschool@gmail.com", label: "School Admin 1" },
];

const SCENARIO_ASSIGNMENTS = [
  // Benjamin gets 8
  { scenarioId: "6956413875b034cf3bba8c81", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69564c2575b034cf3bba8c82", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "6956668275b034cf3bba8c83", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69566c3875b034cf3bba8c84", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69566d1e75b034cf3bba8c85", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69ca74777aa84c0bc7376af4", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69cf4179994ff71033d03d7f", educatorEmail: "benjamindemo@email.com" },
  { scenarioId: "69cff9069d65cb8f627dfb87", educatorEmail: "benjamindemo@email.com" },
  // John Teacher gets 2
  { scenarioId: "69d273d7f6936e53c408837d", educatorEmail: "teacher@school.com" },
  { scenarioId: "69d28165db180aa71cbe8916", educatorEmail: "teacher@school.com" },
  // Kapil School Owner gets 2
  { scenarioId: "6a18733e5c7a8cd76cb8c2ca", educatorEmail: "rntayllor@gmail.com" },
  { scenarioId: "6a231e9f090848bc155f72fb", educatorEmail: "rntayllor@gmail.com" },
  // School Admin 1 gets 2
  { scenarioId: "6a231f19090848bc155f7314", educatorEmail: "testschool@gmail.com" },
  { scenarioId: "6a2d04ba9d9466ad26ef67c1", educatorEmail: "testschool@gmail.com" },
];

// ============================================================
// STEP 1: Link educators to SIT school
// ============================================================

const linkEducatorsToSIT = async () => {
  console.log("\n📌 STEP 1: Linking educators to SIT school...");
  let linkedCount = 0;
  let skipCount = 0;

  for (const edu of EDUCATORS) {
    const user = await User.findOne({ email: edu.email });
    if (!user) {
      console.log(`  ⚠ User not found: ${edu.email} (${edu.label}) — skipping`);
      continue;
    }

    if (user.schoolId && user.schoolId.toString() === SIT_SCHOOL_ID) {
      console.log(`  - ${edu.label} (${edu.email}) — already linked to SIT`);
      skipCount++;
      continue;
    }

    user.schoolId = SIT_SCHOOL_ID;
    await user.save();
    linkedCount++;
    console.log(`  ✓ ${edu.label} (${edu.email}) → linked to SIT`);
  }

  console.log(`  → Done: ${linkedCount} linked, ${skipCount} already linked`);
  return linkedCount;
};

// ============================================================
// STEP 2: Reassign scenarios to new educators
// ============================================================

const reassignScenarios = async () => {
  console.log("\n📌 STEP 2: Reassigning scenarios to new educators...");

  const educatorsMap = {};
  for (const edu of EDUCATORS) {
    const user = await User.findOne({ email: edu.email });
    if (user) {
      educatorsMap[edu.email] = { id: user._id, name: edu.label };
    }
  }

  let reassignedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const assignment of SCENARIO_ASSIGNMENTS) {
    const scenario = await Scenario.findById(assignment.scenarioId);
    if (!scenario) {
      console.log(`  ⚠ Scenario not found: ${assignment.scenarioId} — skipping`);
      errorCount++;
      continue;
    }

    const newEducator = educatorsMap[assignment.educatorEmail];
    if (!newEducator) {
      console.log(`  ⚠ Educator not found: ${assignment.educatorEmail} — skipping scenario ${scenario.scenarioName}`);
      errorCount++;
      continue;
    }

    const oldEducatorName = scenario.educator ? (await User.findById(scenario.educator).lean())?.name || "unknown" : "none";

    scenario.educator = newEducator.id;
    scenario.schoolId = SIT_SCHOOL_ID;

    // If status is "success", change to "Published" for consistency
    if (scenario.status === "success") {
      scenario.status = "Published";
    }

    await scenario.save();
    reassignedCount++;
    console.log(`  ✓ "${scenario.scenarioName.substring(0, 60)}..."`);
    console.log(`       → ${oldEducatorName} → ${newEducator.name}`);
  }

  console.log(`  → Done: ${reassignedCount} reassigned, ${skipCount} skipped, ${errorCount} errors`);
  return reassignedCount;
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  console.log("=".repeat(60));
  console.log("  REASSIGN 14 SCENARIOS TO SIT EDUCATORS");
  console.log("=".repeat(60));

  try {
    await connectDB();

    const sitSchool = await School.findById(SIT_SCHOOL_ID);
    if (!sitSchool) {
      console.error(`❌ SIT school not found (ID: ${SIT_SCHOOL_ID})`);
      process.exit(1);
    }
    console.log(`\n📋 Target school: "${sitSchool.schoolName}" (${sitSchool._id})`);

    await linkEducatorsToSIT();
    await reassignScenarios();

    console.log("\n" + "=".repeat(60));
    console.log("  ✅ REASSIGNMENT COMPLETE");
    console.log("=".repeat(60));

    // Final verification
    console.log("\n📋 Final verification:");
    for (const edu of EDUCATORS) {
      const user = await User.findOne({ email: edu.email });
      if (!user) continue;
      const count = await Scenario.countDocuments({ educator: user._id });
      console.log(`  ${edu.label}: ${count} scenarios owned`);
    }

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
