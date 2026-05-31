import mongoose from "mongoose";

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

    animationTriggers: {
      shoulder: [{ type: String }],
      neck: [{ type: String }],
    },
    html: { type: String },
  },
  {
    timestamps: true,
  },
);

const Scenario = mongoose.model("Scenario", scenarioSchema);
export default Scenario;
