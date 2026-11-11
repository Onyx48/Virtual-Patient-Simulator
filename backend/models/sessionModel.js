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
    /*
     * An educator's correction of the grader (mindsets/educator.md, M3: they stay the judge).
     * `observed` above stays as the AI said it; the effective verdict is review.observed when set.
     */
    review: {
      type: new mongoose.Schema(
        {
          observed: { type: String, enum: ["yes", "partly", "no"] },
          note: { type: String, default: "" },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          byName: { type: String, default: "" },
          at: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },
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
  // The educator's own note on the whole session. Never shown to the student.
  educator_note: {
    type: new mongoose.Schema(
      {
        text: { type: String, default: "" },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byName: { type: String, default: "" },
        at: { type: Date },
      },
      { _id: false },
    ),
    default: undefined,
    select: false,
  },
  // The student's own note on this attempt ("ask about night pain first"). Only the student reads it.
  student_note: { type: String, default: undefined, maxlength: 2000, select: false },
  // The student saying something went wrong (misheard, feedback, technical). Shown to the educator.
  student_flag: {
    type: new mongoose.Schema(
      {
        reason: { type: String, enum: ["misheard", "feedback", "technical", "other"] },
        text: { type: String, default: "" },
        at: { type: Date },
      },
      { _id: false },
    ),
    default: undefined,
  },
  // "How realistic did the patient feel?" 1-5, from the student after an attempt. Case quality signal.
  student_rating: { type: Number, min: 1, max: 5, default: undefined },
  // Clinical Reasoning result (utils/reasoningScore.js reasoningRecord): status, percent, the five
  // criteria, went well / work on, the case reveal, and two educator-only flags.
  clinical_reasoning: { type: mongoose.Schema.Types.Mixed, default: undefined },
  // History-taking timeline (docs/HT_TIMELINE_PLAN.md): per-turn scores from the silent scorer,
  // [{ turn, at, status: scored|empty|failed, scores: { questioning: { type_, score, description } } }],
  // the roll-up per dimension, and whether every turn was scored.
  ht_turns: { type: mongoose.Schema.Types.Mixed, default: undefined },
  ht_final: { type: mongoose.Schema.Types.Mixed, default: undefined },
  ht_state: { type: String, enum: ["unscored", "partial", "complete"], default: undefined },
  student_id: { type: String, required: true },
  scenario_id: { type: String, required: true },
}, {
  timestamps: true,
});

// Indexes for the scoped lists and lookups (added for scale; additive, built at startup).
sessionSchema.index({ student_id: 1, createdAt: -1 });
sessionSchema.index({ scenario_id: 1 });
sessionSchema.index({ createdAt: -1 });
const Session = mongoose.model("Session", sessionSchema);
export default Session;
