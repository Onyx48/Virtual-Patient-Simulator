/**
 * Creates the Farukh cervical-spondylosis scenario under Daniel Okafor.
 *
 * Run with: node scripts/seedFarukhScenario.mjs
 *
 * A one-off, and idempotent: re-running finds the scenario by name and updates it
 * in place rather than adding a second copy. It goes through the real Voxio
 * createFlow so the scenario is actually conversational — POST /api/scenarios
 * takes the api_key from its caller and does not mint one, so inserting straight
 * into Mongo would have produced a scenario that opens and then cannot talk.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const { buildWorkflow, createFlow, updateFlow } = await import(
  "../backend/utils/voxioClient.js"
);
const Scenario = (await import("../backend/models/scenarioModel.js")).default;
const User = (await import("../backend/models/userModel.js")).default;

// The scenario this script owns. Also the id allow-listed for the simulator in
// backend/utils/testableScenarios.js, so the two must not drift.
const SCENARIO_ID = "6a9c857f8df9099b1edea1cd";

const SCENARIO_NAME =
  "Farukh, a 55-year-old with chronic neck pain and stiffness";

const SCENARIO_PROMPT = `Physiotherapy Case: Chronic Cervical Spondylosis in a Civil Engineer

Patient Profile: Name: Farukh, Age: 55, Occupation: Civil engineer, Presenting Complaint: Chronic neck pain and stiffness.

History of Present Illness: Farukh, a 55-year-old civil engineer, presents with a 6-month history of worsening neck pain and stiffness. The pain is primarily located in the cervical spine and bilateral trapezius region, described as a dull ache, with occasional sharp twinges upon movement. It does not radiate down the arms. The pain is worse in the mornings and after prolonged desk work, reading drawings or watching TV. It is partially relieved by resting and applying a heat pack. He denies any associated numbness, tingling, weakness, or headaches. No history of trauma.

Medical History: PMH: Osteoarthritis (diagnosed 5 years ago, affecting knees), well-controlled hypertension. Surgical Hx: None. Medications: Ramipril 5mg OD, Paracetamol PRN for pain. Allergies: None known. Family Hx: Mother had osteoarthritis.

Social History: Farukh lives alone in a single-story house since his wife passed away two years ago. He is very independent but finds that his neck pain is making it harder to get through a full day at his desk, read his daily newspaper, enjoy his gardening (looking down is painful), and drive for long periods to visit his family. He is concerned about not being able to keep working as he does and about losing his ability to maintain his garden, which is his main hobby and source of satisfaction. He smokes occasionally (socially, 2-3 cigarettes/week for years but trying to quit), drinks alcohol rarely.

Relevant Investigations: No recent imaging. An X-ray of the cervical spine from 5 years ago showed 'early degenerative changes'.

Previous Treatment: Tried over-the-counter paracetamol for pain, which offers mild, temporary relief. Has not seen a physiotherapist for this specific issue before.

Simulated Physical Examination Findings: General appearance: Appears comfortable at rest, slightly guarded with neck movements. Neck: Active range of motion (AROM) significantly limited and painful in flexion, extension, left rotation, right rotation, left lateral flexion, right lateral flexion. Retraction is limited and painful. Protraction is full and pain-free. Palpation reveals tenderness over C5-C7 spinous processes and bilateral upper trapezius muscles. No muscle spasm. Shoulder: Bilateral shoulder AROM is full and pain-free in all directions. No tenderness on palpation of shoulder musculature or joints. Neurological screen: Sensation, motor strength, and reflexes intact in bilateral upper extremities. No signs of myelopathy or radiculopathy.

Patient's aim and goals of treatment: Reduce neck pain, improve flexibility to keep working comfortably and continue reading and gardening, and avoid future worsening.

Simulation Objectives for Student: 1. Take a comprehensive subjective history focusing on chronic pain and its impact on a working adult's life. 2. Formulate a differential diagnosis for chronic neck pain in a middle-aged patient. 3. Discuss appropriate management strategies, considering his age, comorbidities, work demands and psychosocial factors. 4. Address the patient's concerns regarding his work and his hobbies.

--- Simulation Instructions ---
You are a Patient Education Chatbot. Your purpose is to simulate a patient encounter for a medical student. You will act as Farukh based *only* on the detailed medical case information provided above.
Before responding to the student's *first* message, verify if the scenario above strictly pertains to the NECK or SHOULDER. If NO, your *only* response must be: 'Sorry we only support neck and shoulder right now'. If YES, proceed with the simulation.
IMPORTANT: Use simple, everyday language. AVOID medical jargon from the case details unless the scenario explicitly states the patient was told a specific term. Translate medical facts into subjective patient experiences (e.g., if external rotation is limited, say "I struggle to reach for the seatbelt or brush my hair").
Initial Greeting: If the student's first message is only a greeting (e.g., 'Hi', 'Good morning'), your first response MUST also be only a simple greeting back (e.g., 'Hi', 'Morning').
Wait for the Prompt: Do NOT immediately state your symptoms or reason for visiting after the initial greeting. Wait for the student to explicitly ask a question like 'What brings you in?' before you describe your main complaint.
Answer Specifically: Once prompted, answer only the specific question asked in each turn. Do not volunteer extra information or 'data dump' your entire history at once.
Concise Responses: Keep your answers brief, typically 1-3 sentences.
Let the Student Lead: Allow the student to guide the history-taking process with their questions.
Act a bit resigned to the pain, but also hopeful that something can be done. He might sigh occasionally when describing how the pain affects his work and his hobbies. He values his independence greatly.
Base ALL answers *only* on the scenario details. If asked something not covered, give a brief, plausible, patient-like answer.
Act like a human patient. Do NOT reveal you are a chatbot or AI.

--- Sample Conversation ---
(role: 'user', content: 'Good morning, Farukh.')
(role: 'assistant', content: 'Good morning.')
(role: 'user', content: 'I'm [Student Name], a student physiotherapist. Thanks for coming in. What brings you here today?')
(role: 'assistant', content: 'Well, it's my neck. It's been aching and stiff for months.')`;

/*
 * The coach marks the student against these, one per line. Written as "Did the
 * student ..." to match every other scenario in the database — the grader keys off
 * that phrasing, so a differently-worded question scores unreliably.
 *
 * The first block is the generic subjective-history checklist; the rest are
 * specific to Farukh — his comorbidities, and the work and gardening worries that
 * are the point of this case.
 */
const FEEDBACK_QUESTIONS = [
  "Did the student inquire about the onset and duration of the neck pain?",
  "Did the student ask about aggravating and relieving factors?",
  "Did the student ask about the nature and quality of the pain (e.g. dull ache, sharp, burning)?",
  "Did the student explore the 24-hour behaviour of the symptoms, including the morning stiffness?",
  "Did the student ask whether the pain radiates into the arms or elsewhere?",
  "Did the student screen for numbness, tingling, weakness or clumsiness in the arms and hands?",
  "Did the student screen for red flags (unexplained weight loss, night pain, gait or balance change, bowel or bladder change, dizziness on neck movement)?",
  "Did the student ask about headaches or dizziness?",
  "Did the student ask about any history of trauma, fall or injury to the neck?",
  "Did the student ask about any other painful area in the body, to clear the rest of the body?",
  "Did the student ask about previous imaging or investigations (X-ray, MRI, scans)?",
  "Did the student ask about the patient's past medical history, including his osteoarthritis and hypertension?",
  "Did the student ask about current medications, including the ramipril and the paracetamol?",
  "Did the student ask about previous treatment for this problem and how effective it was?",
  "Did the student ask about allergies?",
  "Did the student ask about family history?",
  "Did the student ask about smoking and alcohol?",
  "Did the student ask about the patient's job and how his desk work and reading drawings affect his symptoms?",
  "Did the student explore how the pain affects the patient's daily activities — reading, watching TV, gardening and driving?",
  "Did the student ask about the patient's home situation and the fact that he lives alone?",
  "Did the student explore the patient's worry about not being able to keep working as he does?",
  "Did the student acknowledge how much the garden means to the patient rather than treating it as a minor detail?",
  "Did the student ask about the patient's own aim and goals for physiotherapy treatment?",
  "Did the student ask about sleep and sleeping position?",
  "Did the student ask about the patient's usual level of physical activity and function?",
  "Did the student ask what the patient thinks is causing the problem and what he is most worried about?",
  "Did the student provide a statement showing empathy towards the patient's condition and reassure him about his concerns?",
  "Did the student use clear, professional, layperson language rather than medical jargon throughout?",
  "Did the student demonstrate active listening and appropriate follow-up questions rather than reading from a list?",
  "Did the student avoid dismissing the problem as simply wear and tear, and explain the degenerative changes in a way that did not frighten the patient?",
  "Did the student explain the likely diagnosis and a management plan appropriate to a working 55-year-old with osteoarthritis and hypertension?",
  "Did the student discuss workstation setup, posture and taking breaks from prolonged desk work?",
];

/*
 * The simulator's avatar moves according to these. From the examination findings:
 * every neck movement limited except protraction, and the shoulder entirely clear
 * — the clear shoulder is stated explicitly rather than left blank, because an
 * empty region reads as "not recorded" instead of "normal".
 */
const ANIMATION_TRIGGERS = {
  neck: [
    "Flexion_Ltd",
    "Extension_Ltd",
    "Left_Rotation_Ltd",
    "Right_Rotation_Ltd",
    "Protraction_Full",
    "Retraction_Ltd",
    "Right_Lateral_Flexion_Ltd",
    "Left_Lateral_Flexion_Ltd",
  ],
  shoulder: [
    "Flexion_Full",
    "Extension_Full",
    "Abduction_Full",
    "External_Rotation_Full",
    "Internal_Rotation_Full",
    "Horizontal_Adduction_Full",
    "Hand_behind_Back_Full",
    "Hand_behind_Neck_Full",
  ],
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);

  const educator = await User.findOne({
    email: "daniel.okafor@riversidephysio.edu",
  }).lean();
  if (!educator) throw new Error("Daniel Okafor was not found.");
  console.log(`educator: ${educator.name} <${educator.email}> ${educator._id}`);

  // Everyone he teaches should be able to open it, so assignment is by school
  // rather than by hand-picked ids.
  const students = await User.find({
    role: "student",
    schoolId: educator.schoolId,
  })
    .select("_id name")
    .lean();
  console.log(`assigning to ${students.length} student(s) at his school`);

  /*
   * Looked up by id, not by name. The name has already changed once (this case was
   * Ajon, 75, before it became Farukh, 55) and matching on it would have created a
   * second scenario instead of editing the one the simulator is pinned to in
   * backend/utils/testableScenarios.js.
   */
  const existing = await Scenario.findById(SCENARIO_ID);

  /*
   * The flow is minted once and thereafter edited in place — a second createFlow
   * would leave the first one orphaned. It must be edited, not just left alone:
   * the flow is where the prompt and the marking questions actually live, so a
   * scenario row updated without its flow would converse and grade against the
   * previous version of the case.
   */
  const workflow = buildWorkflow({
    scenarioPrompt: SCENARIO_PROMPT,
    feedbackQuestions: FEEDBACK_QUESTIONS,
  });

  let apiKey = existing?.apiKey || "";
  if (apiKey) {
    /*
     * Voxio's PUT /edit-flow currently answers 404 even for a key its own
     * GET /flow accepts, so editing in place is not available. A fresh flow is
     * minted instead and the scenario repointed at it — the old flow is left
     * orphaned, which is the lesser problem next to a case that grades against a
     * prompt nobody can see.
     */
    try {
      await updateFlow({ apiKey, flowName: SCENARIO_NAME, workflow });
      console.log(`updated the existing Voxio flow (${apiKey.slice(0, 12)}…)`);
    } catch (err) {
      console.warn(`could not edit the existing flow (${err.message})`);
      apiKey = await createFlow({ flowName: SCENARIO_NAME, workflow });
      console.log(`minted a replacement flow, api_key ${apiKey.slice(0, 12)}…`);
    }
  } else {
    apiKey = await createFlow({ flowName: SCENARIO_NAME, workflow });
    console.log(`created Voxio flow, api_key ${apiKey.slice(0, 12)}…`);
  }

  const fields = {
    scenarioName: SCENARIO_NAME,
    description: SCENARIO_NAME,
    educator: educator._id,
    creator: educator._id,
    schoolId: educator.schoolId,
    status: "Published",
    permissions: "Read Only",
    assignedTo: students.map((student) => student._id),
    assignedGroups: [],
    template: "",
    scenarioPrompt: SCENARIO_PROMPT,
    aiAvatarRole: "",
    aiInstructions: "",
    aiQuestions: FEEDBACK_QUESTIONS.join("\n"),
    difficulty: "Medium",
    animationTriggers: ANIMATION_TRIGGERS,
    apiKey,
    html: "",
  };

  const scenario = existing
    ? await Scenario.findByIdAndUpdate(existing._id, fields, { new: true })
    // Created with the fixed id, so the simulator allow-list stays valid even if
    // this ever has to be rebuilt from scratch.
    : await Scenario.create({ ...fields, _id: SCENARIO_ID });

  console.log(`${existing ? "updated" : "created"} scenario ${scenario._id}`);
  console.log(`\nTESTABLE_SCENARIO_IDS=${scenario._id}`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
