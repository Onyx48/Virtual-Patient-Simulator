import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "../../AuthContext";
import axios from "axios";
import {
  addScenario,
  updateScenario,
} from "../../redux/slices/scenarioSlice.js";
import { Sparkles, ArrowUp, Loader, X, AlertCircle } from "lucide-react";

// Import React Quill for Rich Text Editing
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8888";

// Error Modal Component
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

// Movement Configuration Definitions mapping exactly to the screenshot
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

// Rich Text Editor Toolbar Configuration
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
      movements: {
        shoulder: {},
        neck: {},
      },
      hdml: "",
      scenarioPrompt: "",
      questionsForFeedback: "",
    },
  });

  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorPopup, setErrorPopup] = useState({ open: false, message: "" });

  const isSchoolAdmin = user?.role === "school_admin";
  const isEducator = user?.role === "educator";

  useEffect(() => {
    if (!isEducator && !isSchoolAdmin) navigate("/dashboard");
  }, [isEducator, isSchoolAdmin, navigate]);

  useEffect(() => {
    if (isDbEdit && selectedScenario) {
      setValue("scenarioName", selectedScenario.scenarioName || "");
      setValue("difficulty", selectedScenario.difficulty || "Medium");
      setValue("status", selectedScenario.status || "Draft");
      setValue("shortDescription", selectedScenario.shortDescription || "");
      setValue("scenarioPrompt", selectedScenario.scenarioPrompt || "");
      setValue(
        "questionsForFeedback",
        selectedScenario.questionsForFeedback || "",
      );
      if (selectedScenario.movements)
        setValue("movements", selectedScenario.movements);
      if (selectedScenario.hdml) setValue("hdml", selectedScenario.hdml);
    }
  }, [isDbEdit, selectedScenario, setValue]);

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!aiInput) return;
    setIsAiLoading(true);

    try {
      const url = `${AI_SERVICE_URL}/add-scenario`; // Ensure this matches your AI backend endpoint
      const payload = {
        educator_id: user?._id || user?.id,
        scenario_prompt: aiInput,
      };

      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const rawData = response.data;
      const returnedJson = rawData.response ? rawData.response : rawData;

      // 1. Map Text & Dropdown Fields
      if (returnedJson.scenario_name) {
        setValue("scenarioName", returnedJson.scenario_name);
        setValue("shortDescription", returnedJson.scenario_name);
      }
      if (returnedJson.difficulty_level)
        setValue("difficulty", returnedJson.difficulty_level);
      if (returnedJson.status) setValue("status", returnedJson.status);

      // 2. Map Rich Text Editors
      if (returnedJson.scenario_prompt) {
        setValue("scenarioPrompt", returnedJson.scenario_prompt);
      }

      // Auto-convert questions array to bullet points for the rich text editor
      if (
        returnedJson.questions_for_feedback &&
        Array.isArray(returnedJson.questions_for_feedback)
      ) {
        const questionsHtml = `<ul>${returnedJson.questions_for_feedback.map((q) => `<li>${q}</li>`).join("")}</ul>`;
        setValue("questionsForFeedback", questionsHtml);
      } else if (returnedJson.questions_for_feedback) {
        setValue("questionsForFeedback", returnedJson.questions_for_feedback); // Fallback if string
      }

      // 3. Map Radio/Checkbox Movements seamlessly
      if (returnedJson.movements) {
        setValue("movements", returnedJson.movements);
      }

      setAiInput("");
    } catch (error) {
      const msg = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      setErrorPopup({ open: true, message: `AI Error: ${msg}` });
    } finally {
      setIsAiLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      if (isDbEdit) {
        await dispatch(updateScenario({ id, updates: data })).unwrap();
      } else {
        await dispatch(addScenario(data)).unwrap();
      }
      navigate("/scenarios");
    } catch (err) {
      setErrorPopup({
        open: true,
        message: err.message || "Failed to save scenario.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEducator && !isSchoolAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-10 pb-10 px-4 overflow-y-auto">
      <ErrorModal
        isOpen={errorPopup.open}
        message={errorPopup.message}
        onClose={() => setErrorPopup({ ...errorPopup, open: false })}
      />

      <div className="bg-white w-full max-w-[800px] rounded-lg shadow-2xl flex flex-col relative my-auto">
        {/* Top X Close Button (Overlapping boundary like screenshot) */}
        <div className="absolute -top-4 right-1/2 transform translate-x-1/2 z-10">
          <button
            onClick={() => navigate("/scenarios")}
            className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-900 shadow-md transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Header Title */}
        <div className="flex justify-between items-center p-6 pb-2 border-b-0">
          <h2 className="text-xl font-bold text-gray-800">Add Scenario</h2>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 pt-0 overflow-y-auto max-h-[85vh]">
          {/* Top AI Prompt Bar - NOW WITH SPARKLES */}
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

          <form id="scenario-form" className="space-y-6">
            {/* ID & Scenario Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ID
                </label>
                <input
                  type="text"
                  disabled
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

            {/* Difficulty Level & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  {...register("difficulty")}
                  className="w-full border border-gray-300 p-2.5 rounded-md text-sm bg-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Status
                </label>
                <select
                  {...register("status")}
                  className="w-full border border-gray-300 p-2.5 rounded-md text-sm bg-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>
              </div>
            </div>

            {/* Short Description */}
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

            {/* Animation Triggers - Shoulder */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2">
                Animation triggers - Shoulder
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3">
                {SHOULDER_MOVEMENTS.map((movement) => (
                  <div key={`shoulder-${movement.id}`} className="space-y-1">
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
                            {...register(`movements.shoulder.${movement.id}`)}
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

            {/* Animation Triggers - Neck */}
            <div className="pt-2">
              <h3 className="text-sm font-bold text-gray-800 mb-2">
                Animation triggers - Neck
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3">
                {NECK_MOVEMENTS.map((movement) => (
                  <div key={`neck-${movement.id}`} className="space-y-1">
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
                            {...register(`movements.neck.${movement.id}`)}
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

            {/* HDML text area */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                HDML
              </label>
              <textarea
                {...register("hdml")}
                rows={4}
                className="w-full border border-gray-300 p-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
              ></textarea>
            </div>

            {/* Scenario Prompt (React Quill) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Scenario Prompt
              </label>
              <div className="bg-white border-gray-300 rounded-md overflow-hidden">
                <Controller
                  name="scenarioPrompt"
                  control={control}
                  render={({ field }) => (
                    <ReactQuill
                      theme="snow"
                      value={field.value}
                      onChange={field.onChange}
                      modules={quillModules}
                      className="h-48 mb-10"
                    />
                  )}
                />
              </div>
            </div>

            {/* Questions for Feedback (React Quill) */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Questions for & Feedback
              </label>
              <div className="bg-white border-gray-300 rounded-md overflow-hidden">
                <Controller
                  name="questionsForFeedback"
                  control={control}
                  render={({ field }) => (
                    <ReactQuill
                      theme="snow"
                      value={field.value}
                      onChange={field.onChange}
                      modules={quillModules}
                      className="h-48 mb-10"
                    />
                  )}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-lg">
          <button
            type="button"
            className="px-6 py-2 rounded-md text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving || isAiLoading}
            className="px-6 py-2 rounded-md text-sm font-semibold text-white bg-orange-400 hover:bg-orange-500 shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader className="w-4 h-4 animate-spin" />}
            {isDbEdit ? "Save Changes" : "Publish Scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScenarioFormPage;
