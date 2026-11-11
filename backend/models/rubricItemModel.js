import mongoose from "mongoose";

/*
 * One grading question in an educator's rubric bank (after ci/internal-shortlisting's question
 * bank): pasted from an existing OSCE checklist, split by the AI, approved by the educator, then
 * reused as a scenario's feedback questions. New collection; nothing else depends on it.
 */
const rubricItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 1000, trim: true },
    criterion: { type: String, default: "", maxlength: 120, trim: true },
    educatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    source: { type: String, default: "", maxlength: 200 }, // e.g. "OSCE checklist 2025"
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const RubricItem = mongoose.model("RubricItem", rubricItemSchema);
export default RubricItem;
