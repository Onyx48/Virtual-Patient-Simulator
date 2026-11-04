import mongoose from "mongoose";

const transcriptionSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ["system", "user", "assistant"] },
  content: { type: String, required: true },
  // The name the simulator used for this speaker ("h", "John Smith"). Kept so the
  // transcript can be labelled with who actually spoke instead of the generic
  // role; optional, since older rows and list-shaped transcripts carry no name.
  speaker: { type: String, default: "" },
}, { _id: false });

/*
 * The grader's verdict on one grading question: met ("yes"), "partly" or "no",
 * with a short quote as evidence and the History Taking criterion it belongs
 * to. Shown to educators and on the dashboard, not to the student.
 */
const questionResultSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    question: { type: String, default: "" },
    criterion: { type: String, default: null },
    observed: { type: String, enum: ["yes", "partly", "no"], required: true },
    evidence: { type: String, default: "" },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema({
  // The id minted by POST /api/sessions/start and carried in the JWE handoff.
  // Unique so the simulator calling back twice for one run cannot create two
  // session records; sparse because rows written before this field existed
  // have none.
  session_id: { type: String, index: { unique: true, sparse: true } },
  transcription: [transcriptionSchema],
  feedback: { type: String, default: "" },
  score: { type: Number, default: 0 },
  // Excluded from queries unless asked for with "+question_results", so no
  // route can hand it to a student by accident.
  question_results: { type: [questionResultSchema], default: undefined, select: false },
  /*
   * The learner's self-reflection, from the self-reflection-AI-guide, taken
   * before any feedback was shown. self_rating (1-10) and summary are shown on
   * the dashboard; distress_flag is for the educator view only, so routes a
   * student can reach leave it out.
   */
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
  student_id: { type: String, required: true },
  scenario_id: { type: String, required: true },
}, {
  timestamps: true,
});

const Session = mongoose.model("Session", sessionSchema);
export default Session;
