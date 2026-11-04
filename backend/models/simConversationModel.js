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
    // consultation -> reflection (optional) -> reasoning
    phase: { type: String, enum: ["consultation", "reflection", "reasoning"], default: "consultation" },
    diagnosis_history: [turnSchema],
    // The self-reflection-AI-guide's conversation. Starts with the hidden
    // [START_OF_REFLECTION] turn that opens it.
    reflection_history: [turnSchema],
    // What the guide returned at [END_OF_REFLECTION] (see sessionModel's reflection).
    reflection: {
      type: new mongoose.Schema(
        {
          self_rating: { type: Number, default: null },
          summary: { type: String, default: null },
          status: { type: String, enum: ["completed", "partial", "skipped", "ended_early_distress"] },
          distress_flag: { type: Boolean, default: false },
          completed_at: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },
    reasoning_history: [turnSchema],
    feedback: { type: String, default: "" },
    score: { type: Number, default: null }, // graded share, 0-1
    // Per-question verdicts from the grader (see sessionModel's question_results).
    question_results: [
      new mongoose.Schema(
        {
          number: { type: Number, required: true },
          question: { type: String, default: "" },
          criterion: { type: String, default: null },
          observed: { type: String, enum: ["yes", "partly", "no"], required: true },
          evidence: { type: String, default: "" },
        },
        { _id: false },
      ),
    ],
    end_diagnosis: { type: String, default: "no" },
  },
  { timestamps: true },
);

export default mongoose.model("SimConversation", simConversationSchema);
