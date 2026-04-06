import mongoose from "mongoose";

const transcriptionSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ["system", "user", "assistant"] },
  content: { type: String, required: true },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  transcription: [transcriptionSchema],
  feedback: { type: String, default: "" },
  score: { type: Number, default: 0 },
  student_id: { type: String, required: true },
  scenario_id: { type: String, required: true },
}, {
  timestamps: true,
});

const Session = mongoose.model("Session", sessionSchema);
export default Session;
