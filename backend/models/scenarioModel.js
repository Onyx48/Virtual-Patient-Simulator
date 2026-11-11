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
    /*
     * What the learner should get out of this case, one per line. Written by
     * the AI with the scenario and editable on the form; read by the
     * self-reflection-AI-guide (utils/simEngine.js), which needs the objectives
     * but must not see the grading questions.
     */
    learningObjectives: { type: String, default: "" },
    difficulty: { type: String, default: "Medium" },

    apiKey: { type: String },

    // Physiotherapy or occupational therapy (utils/profession.js). Decides the
    // simulator's wording and the standard feedback questions.
    profession: {
      type: String,
      enum: ["physiotherapy", "occupational_therapy"],
      default: "physiotherapy",
    },

    // "sg": a Singapore patient (utils/sgScenario.js). The fixed Singapore speaking
    // standard is added in front of scenarioPrompt for the patient at session time.
    locale: { type: String, enum: ["", "sg"], default: "" },

    // Key of this scenario's flow in Voxio's gpu environment, used by the educator's
    // Test room (/room.html). Separate from apiKey, the standard flow the game uses.
    roomFlowKey: { type: String, default: "" },

    /*
     * The state of this scenario's Voxio flow (utils/voxioSync.js): written each
     * time the scenario is saved and the flow is created or updated to match.
     */
    voxioSync: {
      status: { type: String, enum: ["pending", "synced", "failed"], default: undefined },
      at: { type: Date },
      error: { type: String },
    },

    /*
     * Who the simulator plays, served by GET /api/scenarios/json so the avatar's
     * voice and look match the patient. The AI routes extract them from the
     * prompt they generate; scripts/backfillPatientInfo.mjs fills older ones.
     */
    patientName: { type: String, trim: true },
    patientGender: { type: String, enum: ["Male", "Female", ""], default: "" },
    language: { type: String, trim: true },

    // Ids from src/lib/scenarioOptions.js, picked on the scenario form.
    environment: { type: String, trim: true, default: "" },
    avatarModel: { type: String, trim: true, default: "" },

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

// Indexes for the scoped lists and lookups (added for scale; additive, built at startup).
scenarioSchema.index({ educator: 1, createdAt: -1 });
scenarioSchema.index({ schoolId: 1, createdAt: -1 });
scenarioSchema.index({ assignedTo: 1 });
scenarioSchema.index({ assignedGroups: 1 });
scenarioSchema.index({ createdAt: -1 });
const Scenario = mongoose.model("Scenario", scenarioSchema);
export default Scenario;
