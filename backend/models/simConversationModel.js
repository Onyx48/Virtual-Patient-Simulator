import mongoose from "mongoose";

/**
 * The live state of one simulator run, owned by this backend since Voxio was
 * retired: which phase it is in and every turn so far. One per session_id.
 *
 * Kept apart from Session because an educator's Test run has no student, and
 * Session requires one. When a Session row with the same session_id exists, the
 * transcript, feedback and score are copied onto it as they are produced.
 */
const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const simConversationSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true },
    scenario_id: { type: String, required: true },
    // consultation -> (end) -> reasoning
    phase: { type: String, enum: ["consultation", "reasoning"], default: "consultation" },
    diagnosis_history: [turnSchema],
    reasoning_history: [turnSchema],
    feedback: { type: String, default: "" },
    score: { type: Number, default: null }, // graded share, 0-1
    end_diagnosis: { type: String, default: "no" },
  },
  { timestamps: true },
);

export default mongoose.model("SimConversation", simConversationSchema);
