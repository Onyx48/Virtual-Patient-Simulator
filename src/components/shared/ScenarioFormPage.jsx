import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "../../AuthContext";
import axios from "axios";
import {
  addScenario,
  updateScenario,
  deleteScenario,
} from "../../redux/slices/scenarioSlice.js";
import { Sparkles, ArrowUp, Loader, X, AlertCircle } from "lucide-react";

import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import ConfirmationModal from "../ui/ConfirmationModal";

// AI generation now runs inside this backend (backend/routes/scenarioRoutes.js),
// so it goes through the shared axios instance and carries the auth header.
// The old standalone :8888 FastAPI service is gone.

const ErrorModal = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 font-bold">
            <AlertCircle className="w-5 h-5" />
            <span>Action Failed</span>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/*
 * The body regions a scenario can cover, and the movements each one offers.
 *
 * This drives the animation-trigger UI, the payload sent to the backend and the
 * parsing of what comes back, so a region only has to be described once. It must
 * stay in step with backend/utils/bodyRegions.js (the region list) and the
 * `movements` templates in backend/ai/prompts/scenario-{creation,editing}.md
 * (which movements exist per region, and their allowed values) — the AI fills
 * these same keys, and a mismatch silently drops its answer on the floor.
 *
 * Values are categorical, not degrees: "Full", "Ltd", or a graded limit like
 * "90_Ltd" where a threshold is clinically meaningful.
 */
const FULL_LTD = ["Full", "Ltd"];
// Shoulder flexion only. The graded values name animations in the avatar rig, so
// this list is a contract with the simulator and must not gain a value the rig
// has no clip for.
const GRADED = ["Full", "90_Ltd", "120_Ltd"];
/*
 * Hip and knee flexion. Same grading, plus a plain "Ltd" for a case where no
 * threshold is clinically meaningful — the AI reaches for it often, and without
 * it the value matches no radio, so the restriction silently vanishes when the
 * educator saves. Safe to add here because these regions have no avatar rig yet.
 */
const GRADED_OR_LTD = ["Full", "Ltd", "90_Ltd", "120_Ltd"];

const SHOULDER_MOVEMENTS = [
  { id: "flexion", label: "Flexion", options: ["Full", "90_Ltd", "120_Ltd"] },
  { id: "extension", label: "Extension", options: ["Full", "Ltd"] },
  { id: "abduction", label: "Abduction", options: ["Full", "Ltd"] },
  {
    id: "external_rotation",
    label: "External_Rotation",
    options: ["Full", "Ltd"],
  },
  {
    id: "internal_rotation",
    label: "Internal_Rotation",
    options: ["Full", "Ltd"],
  },
  {
    id: "horizontal_adduction",
    label: "Horizontal_Adduction",
    options: ["Full", "Ltd"],
  },
  {
    id: "hand_behind_back",
    label: "Hand_behind_Back",
    options: ["Full", "Ltd"],
  },
  {
    id: "hand_behind_neck",
    label: "Hand_behind_Neck",
    options: ["Full", "Ltd"],
  },
];

const NECK_MOVEMENTS = [
  { id: "flexion", label: "Flexion", options: ["Full", "Ltd"] },
  { id: "extension", label: "Extension", options: ["Full", "Ltd"] },
  { id: "left_rotation", label: "Left_Rotation", options: ["Full", "Ltd"] },
  { id: "right_rotation", label: "Right_Rotation", options: ["Full", "Ltd"] },
  { id: "protraction", label: "Protraction", options: ["Full", "Ltd"] },
  { id: "retraction", label: "Retraction", options: ["Full", "Ltd"] },
  {
    id: "right_lateral_flexion",
    label: "Right_Lateral_Flexion",
    options: ["Full", "Ltd"],
  },
  {
    id: "left_lateral_flexion",
    label: "Left_Lateral_Flexion",
    options: ["Full", "Ltd"],
  },
];

const LOWER_BACK_MOVEMENTS = [
  { id: "flexion", label: "Flexion", options: FULL_LTD },
  { id: "extension", label: "Extension", options: FULL_LTD },
  {
    id: "left_lateral_flexion",
    label: "Left_Lateral_Flexion",
    options: FULL_LTD,
  },
  {
    id: "right_lateral_flexion",
    label: "Right_Lateral_Flexion",
    options: FULL_LTD,
  },
  { id: "left_rotation", label: "Left_Rotation", options: FULL_LTD },
  { id: "right_rotation", label: "Right_Rotation", options: FULL_LTD },
];

const HIP_MOVEMENTS = [
  { id: "flexion", label: "Flexion", options: GRADED_OR_LTD },
  { id: "extension", label: "Extension", options: FULL_LTD },
  { id: "abduction", label: "Abduction", options: FULL_LTD },
  { id: "adduction", label: "Adduction", options: FULL_LTD },
  { id: "internal_rotation", label: "Internal_Rotation", options: FULL_LTD },
  { id: "external_rotation", label: "External_Rotation", options: FULL_LTD },
];

const KNEE_MOVEMENTS = [
  { id: "flexion", label: "Flexion", options: GRADED_OR_LTD },
  // "Ltd" here means an extension lag or fixed flexion deformity.
  { id: "extension", label: "Extension", options: FULL_LTD },
];

const ANKLE_MOVEMENTS = [
  { id: "dorsiflexion", label: "Dorsiflexion", options: FULL_LTD },
  { id: "plantarflexion", label: "Plantarflexion", options: FULL_LTD },
  { id: "inversion", label: "Inversion", options: FULL_LTD },
  { id: "eversion", label: "Eversion", options: FULL_LTD },
];

const FOOT_MOVEMENTS = [
  {
    id: "great_toe_extension",
    label: "Great_Toe_Extension",
    options: FULL_LTD,
  },
  { id: "great_toe_flexion", label: "Great_Toe_Flexion", options: FULL_LTD },
  { id: "forefoot_pronation", label: "Forefoot_Pronation", options: FULL_LTD },
  {
    id: "forefoot_supination",
    label: "Forefoot_Supination",
    options: FULL_LTD,
  },
];

/*
 * Order here is the order the sections appear in the form: head down to toe,
 * which is how a clinician reads a body chart.
 */
const REGIONS = [
  { id: "shoulder", label: "Shoulder", movements: SHOULDER_MOVEMENTS },
  { id: "neck", label: "Neck", movements: NECK_MOVEMENTS },
  { id: "lower_back", label: "Lower back", movements: LOWER_BACK_MOVEMENTS },
  { id: "hip", label: "Hip", movements: HIP_MOVEMENTS },
  { id: "knee", label: "Knee", movements: KNEE_MOVEMENTS },
  { id: "ankle", label: "Ankle", movements: ANKLE_MOVEMENTS },
  { id: "foot", label: "Foot", movements: FOOT_MOVEMENTS },
];

const emptyMovements = () =>
  Object.fromEntries(REGIONS.map((region) => [region.id, {}]));

const quillModules = {
  toolbar: [
    [{ font: [] }, { size: [] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ script: "sub" }, { script: "super" }],
    [{ header: "1" }, { header: "2" }, "blockquote", "code-block"],
    [
      { list: "ordered" },
      { list: "bullet" },
      { indent: "-1" },
      { indent: "+1" },
    ],
    [{ direction: "rtl" }, { align: [] }],
    ["link", "image", "video"],
    ["clean"],
  ],
};

/**
 * Form state -> the backend's `animationTriggers`: one array of "Label_Value"
 * strings per region. Unset movements are omitted rather than sent empty, so a
 * region nobody touched stays an empty array.
 */
const formatMovementsForBackend = (movementsObj) =>
  Object.fromEntries(
    REGIONS.map(({ id, movements }) => {
      const chosen = movementsObj?.[id] || {};

      const triggers = movements
        .filter((movement) => chosen[movement.id])
        .map((movement) => `${movement.label}_${chosen[movement.id]}`);

      return [id, triggers];
    }),
  );

/**
 * The inverse, tolerant of both shapes we might be handed: the stored
 * "Label_Value" arrays, or the `{ flexion: "Ltd" }` maps the AI returns under
 * `movements`. An unrecognised region or movement is ignored — an older scenario
 * has no lower-limb keys at all, and that is not an error.
 */
const processIncomingMovements = (incoming) => {
  const result = emptyMovements();
  if (!incoming) return result;

  REGIONS.forEach(({ id, movements }) => {
    const value = incoming[id];
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((str) => {
        const match = movements.find((m) => str.startsWith(m.label + "_"));
        if (match) result[id][match.id] = str.replace(match.label + "_", "");
      });
    } else if (typeof value === "object") {
      result[id] = { ...value };
    }
  });

  return result;
};

/*
 * Shown one after another while the AI works. Generation takes tens of seconds
 * and the backend reports nothing until it finishes, so these are the stages the
 * request goes through rather than measured progress — worded as work underway,
 * never as work completed. The elapsed counter beside them is the honest signal.
 */
const AI_STAGES = [
  "Reading your case description",
  "Writing the patient history",
  "Mapping the range of movement limits",
  "Drafting the feedback questions",
  "Publishing the simulator flow",
];

const STAGE_SECONDS = 6;

function ScenarioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { scenarios } = useSelector((state) => state.scenarios);
  const dispatch = useDispatch();

  const isDbEdit = !!id;
  const selectedScenario = id
    ? scenarios.find((s) => s._id === id || s.id === id)
    : null;

  const { register, handleSubmit, setValue, control } = useForm({
    defaultValues: {
      scenarioName: "",
      difficulty: "Medium",
      status: "Draft",
      shortDescription: "",
      movements: emptyMovements(),
      /*
       * No `html` key. The field was removed from the form, and the submit
       * payload is a spread of these values — leaving an empty default here
       * would send html:"" and wipe whatever an older scenario has stored,
       * because PUT /api/scenarios/:id only skips the field when it is
       * undefined. Omitting it preserves the existing value.
       */
      scenarioPrompt: "",
      questionsForFeedback: "",
    },
  });

  const [aiInput, setAiInput] = useState("");
  // Voxio flow key. Returned by the AI endpoints, saved onto the scenario.
  const [apiKey, setApiKey] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  // Seconds the current AI request has been running; drives the stage caption.
  const [aiElapsed, setAiElapsed] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errorPopup, setErrorPopup] = useState({ open: false, message: "" });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isSchoolAdmin = user?.role === "school_admin";
  const isEducator = user?.role === "educator";

  useEffect(() => {
    if (!isEducator && !isSchoolAdmin) navigate("/dashboard");
  }, [isEducator, isSchoolAdmin, navigate]);

  useEffect(() => {
    if (isDbEdit && selectedScenario) {
      setApiKey(selectedScenario.apiKey || "");
      setValue("scenarioName", selectedScenario.scenarioName || "");
      setValue("difficulty", selectedScenario.difficulty || "Medium");
      setValue("status", selectedScenario.status || "Draft");
      setValue("scenarioPrompt", selectedScenario.scenarioPrompt || "");
      setValue(
        "shortDescription",
        selectedScenario.description || selectedScenario.shortDescription || "",
      );
      setValue(
        "questionsForFeedback",
        selectedScenario.aiQuestions ||
          selectedScenario.questionsForFeedback ||
          "",
      );

      if (selectedScenario.animationTriggers || selectedScenario.movements) {
        setValue(
          "movements",
          processIncomingMovements(
            selectedScenario.animationTriggers || selectedScenario.movements,
          ),
        );
      }

    }
  }, [isDbEdit, selectedScenario, setValue]);

  // Ticks once a second only while a request is in flight, and is torn down when
  // it finishes so nothing keeps running behind a closed form.
  useEffect(() => {
    if (!isAiLoading) return undefined;
    const timer = setInterval(() => setAiElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isAiLoading]);

  // Holds on the last stage rather than looping, so a slow request does not look
  // like it has restarted.
  const aiStage =
    AI_STAGES[
      Math.min(Math.floor(aiElapsed / STAGE_SECONDS), AI_STAGES.length - 1)
    ];

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!aiInput) return;
    setAiElapsed(0);
    setIsAiLoading(true);

    try {
      // Editing an existing scenario updates the simulator flow it already owns
      // (identified by its apiKey); everything else creates a new flow.
      const existingApiKey = isDbEdit
        ? apiKey || selectedScenario?.apiKey
        : null;
      const url = existingApiKey
        ? "/api/scenarios/ai/edit"
        : "/api/scenarios/ai/generate";

      const response = await axios.post(url, {
        scenario_prompt: aiInput,
        ...(existingApiKey && { api_key: existingApiKey }),
      });

      const rawData = response.data;
      const returnedJson = rawData.response ? rawData.response : rawData;

      if (returnedJson.scenario_name) {
        setValue("scenarioName", returnedJson.scenario_name);
        setValue("shortDescription", returnedJson.scenario_name);
      }
      if (returnedJson.difficulty_level)
        setValue("difficulty", returnedJson.difficulty_level);

      // The simulator key must survive the save, or the scenario can never be
      // edited or run again. Not a form field — held in state and sent on submit.
      if (returnedJson.api_key) setApiKey(returnedJson.api_key);

      if (returnedJson.scenario_prompt) {
        setValue("scenarioPrompt", returnedJson.scenario_prompt);
      }

      if (
        returnedJson.questions_for_feedback &&
        Array.isArray(returnedJson.questions_for_feedback)
      ) {
        const questionsHtml = `<ul>${returnedJson.questions_for_feedback.map((q) => `<li>${q}</li>`).join("")}</ul>`;
        setValue("questionsForFeedback", questionsHtml);
      } else if (returnedJson.questions_for_feedback) {
        setValue("questionsForFeedback", returnedJson.questions_for_feedback);
      }

      if (returnedJson.movements) {
        setValue("movements", processIncomingMovements(returnedJson.movements));
      }
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        (error.response ? JSON.stringify(error.response.data) : error.message);
      setErrorPopup({ open: true, message: `AI Error: ${msg}` });
    } finally {
      setIsAiLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      const formattedTriggers = formatMovementsForBackend(data.movements);
      const payload = {
        ...data,
        description: data.shortDescription,
        animationTriggers: formattedTriggers,
        aiQuestions: data.questionsForFeedback,
        // Only send it when we have one, so a manual edit of an AI scenario
        // cannot blank out its existing key.
        ...(apiKey && { apiKey }),
      };

      if (isDbEdit) {
        await dispatch(updateScenario({ id, updates: payload })).unwrap();
      } else {
        await dispatch(addScenario(payload)).unwrap();
      }
      navigate("/scenarios");
    } catch (err) {
      setErrorPopup({
        open: true,
        message: err?.message || err || "Failed to save scenario.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setShowConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    try {
      await dispatch(deleteScenario(id)).unwrap();
      navigate("/scenarios");
    } catch (err) {
      setErrorPopup({
        open: true,
        message: err?.message || err || "Failed to delete scenario.",
      });
      setIsSaving(false);
    }
  };

  if (!isEducator && !isSchoolAdmin) return null;

  return (
    <>
      {/* Modals are outside the scrollable overlay so fixed positioning
          covers the true viewport and backdrop-blur fills the full screen */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Deletion"
        message="Are you sure you want to delete this scenario?"
      />

      <ErrorModal
        isOpen={errorPopup.open}
        message={errorPopup.message}
        onClose={() => setErrorPopup({ ...errorPopup, open: false })}
      />

      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-10 pb-10 px-4 overflow-y-auto">
        <div className="bg-white w-full max-w-[800px] rounded-lg shadow-2xl flex flex-col relative my-auto isolate">
          <div className="absolute -top-4 right-1/2 transform translate-x-1/2 z-10">
            <button
              onClick={() => navigate("/scenarios")}
              className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-900 shadow-md transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex justify-between items-center p-6 pb-2 border-b-0">
            <h2 className="text-xl font-bold text-gray-800">
              {isDbEdit ? "Edit Scenario" : "Add Scenario"}
            </h2>
          </div>

          <div className="p-6 pt-0 overflow-y-auto max-h-[85vh]">
            <div className="mb-6 p-1 rounded-lg border border-purple-300 bg-white shadow-sm flex items-center relative z-0">
              <div className="pl-3 text-orange-400">
                {isAiLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-orange-400" />
                )}
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskAI(e)}
                disabled={isAiLoading}
                placeholder="Provide input for AI to create scenario"
                className="w-full px-3 py-2 text-sm outline-none bg-transparent placeholder-gray-400 text-gray-700"
              />
              <button
                onClick={handleAskAI}
                disabled={isAiLoading || !aiInput}
                className="mr-1 w-8 h-8 flex justify-center items-center rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>

            {/*
              Progress panel. Sits between the prompt bar and the form so the
              fields the AI is about to fill stay visible underneath — an overlay
              would hide the thing being changed.
            */}
            {isAiLoading && (
              <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50/60 p-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <Loader className="w-4 h-4 shrink-0 animate-spin text-purple-600" />
                  <p
                    className="flex-1 text-sm font-medium text-gray-700"
                    aria-live="polite"
                  >
                    {aiStage}
                    <span className="inline-block w-6 text-left">
                      <span className="animate-pulse">…</span>
                    </span>
                  </p>
                  <span className="shrink-0 font-mono text-xs text-gray-500 tabular-nums">
                    {aiElapsed}s
                  </span>
                </div>

                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-purple-100">
                  <div className="h-full w-1/4 rounded-full bg-purple-500 animate-indeterminate-bar" />
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  This usually takes 20–60 seconds. Please keep this form open.
                </p>
              </div>
            )}

            <form id="scenario-form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={id || ""}
                    className="w-full border border-gray-300 p-2.5 rounded-md bg-gray-50 text-sm text-gray-500"
                    placeholder="Auto-generated"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Scenario Name
                  </label>
                  <input
                    {...register("scenarioName")}
                    type="text"
                    className="w-full border border-gray-300 p-2.5 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="e.g. _MVA_1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  {...register("difficulty")}
                  className="w-full border border-gray-300 p-2.5 rounded-md text-sm bg-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Short Description
                </label>
                <input
                  {...register("shortDescription")}
                  type="text"
                  className="w-full border border-gray-300 p-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Junior MSK physiotherapist practicing history taking and clinical..."
                />
              </div>

              {/*
                One block per region. Every region is always shown: the form has
                no way to know which one the case is about, and a limitation left
                unset simply is not sent.
              */}
              {REGIONS.map((region, index) => (
                <div key={region.id} className={index === 0 ? undefined : "pt-2"}>
                  <h3 className="text-sm font-bold text-gray-800 mb-2">
                    {`Animation triggers - ${region.label}`}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3">
                    {region.movements.map((movement) => (
                      <div
                        key={`${region.id}-${movement.id}`}
                        className="space-y-1"
                      >
                        <label className="text-xs font-semibold text-gray-600 block">
                          {movement.label}
                        </label>
                        <div className="flex flex-wrap gap-4 items-center">
                          {movement.options.map((opt) => (
                            <label
                              key={opt}
                              className="flex items-center text-xs text-gray-700 cursor-pointer"
                            >
                              <input
                                type="radio"
                                {...register(
                                  `movements.${region.id}.${movement.id}`,
                                )}
                                value={opt}
                                className="mr-1.5 w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                              {`${movement.label}_${opt}`}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Scenario Prompt
                </label>
                <div className="bg-white [&_.ql-container]:h-[350px] [&_.ql-editor]:min-h-full">
                  <Controller
                    name="scenarioPrompt"
                    control={control}
                    render={({ field }) => (
                      <ReactQuill
                        theme="snow"
                        value={field.value}
                        onChange={field.onChange}
                        modules={quillModules}
                        // Quill 2's getSemanticHTML() rewrites every space as
                        // &nbsp; and every apostrophe as &#39;. This prompt is
                        // fed to an LLM as a system prompt, so that entity soup
                        // ends up in the model's context. innerHTML keeps the
                        // formatting but leaves the text alone.
                        useSemanticHTML={false}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="pt-6">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Questions for & Feedback
                </label>
                <div className="bg-white [&_.ql-container]:h-[300px] [&_.ql-editor]:min-h-full">
                  <Controller
                    name="questionsForFeedback"
                    control={control}
                    render={({ field }) => (
                      <ReactQuill
                        theme="snow"
                        value={field.value}
                        onChange={field.onChange}
                        modules={quillModules}
                        useSemanticHTML={false}
                      />
                    )}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white rounded-b-lg">
            <div>
              {isDbEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving || isAiLoading}
                  className="px-6 py-2 rounded-md text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setValue("status", "Draft");
                  handleSubmit(onSubmit)();
                }}
                disabled={isSaving || isAiLoading}
                className="px-6 py-2 rounded-md text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 shadow-sm transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => {
                  setValue("status", "Published");
                  handleSubmit(onSubmit)();
                }}
                disabled={isSaving || isAiLoading}
                className="px-6 py-2 rounded-md text-sm font-semibold text-white bg-orange-400 hover:bg-orange-500 shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <Loader className="w-4 h-4 animate-spin" />}
                {isDbEdit ? "Publish Changes" : "Publish Scenario"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ScenarioFormPage;
