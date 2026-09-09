import mongoose from "mongoose";
import { BODY_REGIONS } from "../utils/bodyRegions.js";

const scenarioSchema = new mongoose.Schema(
  {
    scenarioName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    educator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Published", "Archived", "success"],
      default: "Draft",
    },
    permissions: {
      type: String,
      enum: ["Read Only", "Write Only", "Both"],
      default: "Read Only",
    },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    template: { type: String },
    scenarioPrompt: { type: String },
    aiAvatarRole: { type: String },
    aiInstructions: { type: String },
    aiQuestions: { type: String },
    difficulty: { type: String, default: "Medium" },

    apiKey: { type: String },

    /*
     * Range-of-motion limits, one array of "Movement_Value" strings per body
     * region. The region list lives in utils/bodyRegions.js — see there for what
     * else has to change alongside it.
     *
     * Older scenarios only have shoulder and neck; the rest are simply absent,
     * which reads the same as "no limitation recorded".
     */
    animationTriggers: Object.fromEntries(
      BODY_REGIONS.map((region) => [region, [{ type: String }]]),
    ),
    html: { type: String },
  },
  {
    timestamps: true,
  },
);

const Scenario = mongoose.model("Scenario", scenarioSchema);
export default Scenario;
