/**
 * Randomly assigns Benjamin's 5 scenarios to his 369 SIT students.
 * Each student receives exactly SCENARIOS_PER_STUDENT randomly chosen scenarios.
 * Clears all existing assignedTo arrays first, then rebuilds from scratch.
 *
 * Dry run: node assignScenariosRandom.js
 * Apply:   node assignScenariosRandom.js --run
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import User from "../models/userModel.js";
import Scenario from "../models/scenarioModel.js";

const SCENARIOS_PER_STUDENT = 3; // each student gets 3 out of 5 scenarios

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const benjamin = await User.findOne({ name: /benjamin/i, role: "educator" });
  if (!benjamin) {
    console.error("Benjamin not found.");
    process.exit(1);
  }
  console.log(`Educator: ${benjamin.name} (${benjamin._id})\n`);

  const students = await User.find({
    role: "student",
    supervisor: benjamin._id,
  }).select("_id name");

  const scenarios = await Scenario.find({
    educator: benjamin._id,
  }).select("_id scenarioName");

  console.log(`Students: ${students.length}`);
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Assigning ${SCENARIOS_PER_STUDENT} scenarios per student\n`);

  if (scenarios.length < SCENARIOS_PER_STUDENT) {
    console.error("Not enough scenarios to assign.");
    process.exit(1);
  }

  // Build scenario → Set<studentId>
  const assignmentMap = {};
  scenarios.forEach((s) => {
    assignmentMap[s._id.toString()] = new Set();
  });
  const scenarioIds = scenarios.map((s) => s._id.toString());

  for (const student of students) {
    const picked = shuffle(scenarioIds).slice(0, SCENARIOS_PER_STUDENT);
    picked.forEach((sid) => assignmentMap[sid].add(student._id));
  }

  console.log("=== Assignment preview ===");
  scenarios.forEach((s) => {
    const count = assignmentMap[s._id.toString()].size;
    console.log(`  "${s.scenarioName.slice(0, 55)}" → ${count} students`);
  });

  const isDryRun = process.argv[2] !== "--run";
  if (isDryRun) {
    console.log("\nDry run. Pass --run to apply.\n");
    await mongoose.disconnect();
    return;
  }

  console.log("\nApplying...");
  for (const scenario of scenarios) {
    const sid = scenario._id.toString();
    const studentIds = [...assignmentMap[sid]];
    await Scenario.findByIdAndUpdate(scenario._id, {
      $set: { assignedTo: studentIds },
    });
    console.log(
      `  Updated "${scenario.scenarioName.slice(0, 50)}" → ${studentIds.length} students`
    );
  }

  console.log("\nDone.");
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
