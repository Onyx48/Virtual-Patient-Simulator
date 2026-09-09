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
    /*
     * Two independent assignment lists, unioned when deciding what a student can
     * see — see utils/scenarioAssignment.js for why groups are not expanded into
     * assignedTo at write time.
     */
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],

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
