/**
 * Remove unsupported scenarios for Benjamin educator.
 * Unsupported = scenarioName is "Unsupported Scenario"
 *              OR scenarioPrompt is empty/null/"Unsupported Scenario".
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import User from "../models/userModel.js";
import Scenario from "../models/scenarioModel.js";

const MONGO_URI = process.env.MONGODB_URI;

const isUnsupported = (s) => {
  const name = s.scenarioName?.trim().toLowerCase() ?? "";
  const prompt = s.scenarioPrompt?.trim().toLowerCase() ?? "";
  return (
    name === "unsupported scenario" ||
    prompt === "" ||
    prompt === "unsupported scenario"
  );
};

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const benjamin = await User.findOne({ name: /benjamin/i, role: "educator" });

  if (!benjamin) {
    console.log("Benjamin not found.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Educator: ${benjamin.name} (${benjamin.email}) — _id: ${benjamin._id}\n`);

  const allScenarios = await Scenario.find({ educator: benjamin._id });
  console.log(`Total scenarios: ${allScenarios.length}`);

  const unsupported = allScenarios.filter(isUnsupported);
  const supported = allScenarios.filter((s) => !isUnsupported(s));

  console.log(`\nKEEPING (${supported.length}):`);
  supported.forEach((s) => console.log(`  ✓ ${s.scenarioName}`));

  console.log(`\nDELETING (${unsupported.length}):`);
  unsupported.forEach((s) =>
    console.log(`  ✗ [${s._id}] "${s.scenarioName}" | prompt: "${s.scenarioPrompt?.slice(0, 60) ?? "(empty)"}"`),
  );

  if (unsupported.length === 0) {
    console.log("\nNothing to delete.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const ids = unsupported.map((s) => s._id);
  const result = await Scenario.deleteMany({ _id: { $in: ids } });
  console.log(`\nDeleted ${result.deletedCount} scenario(s).`);

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
