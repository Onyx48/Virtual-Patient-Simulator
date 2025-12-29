import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../AuthContext";
import {
  ArrowLeft,
  Sparkles,
  ArrowUp,
  Eye,
  ChevronDown,
  Loader,
} from "lucide-react"; // Removed 'X' icon as deletion is disabled
import axios from "axios";

import { addScenario, updateScenario } from "../../redux/slices/scenarioSlice";

function ScenarioFormPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const { scenarios, loading: reduxLoading } = useSelector(
    (state) => state.scenarios
  );
  const selectedScenario = id
    ? scenarios.find((s) => s._id === id || s.id === id)
    : null;

  const isEdit = !!id;
  const title = isEdit
    ? "Edit Scenario (AI Generated Only)"
    : "Add Scenario (AI Generated Only)";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      scenarioName: "",
      template: "",
      scenarioPrompt: "",
      aiAvatarRole: "",
      aiInstructions: "",
      aiQuestions: "",
      difficulty: "Medium",
      status: "Draft",
      description: "",
      permissions: "Read Only",
      animationTriggers: { shoulder: [], neck: [] },
    },
  });

  const [shoulderTags, setShoulderTags] = useState([]);
  const [neckTags, setNeckTags] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState("");

  const currentDifficulty = watch("difficulty");
  const isSchoolAdmin = user?.role === "school_admin";
  const isEducator = user?.role === "educator";

  useEffect(() => {
    if (!isEducator && !isSchoolAdmin) navigate("/dashboard");
  }, [isEducator, isSchoolAdmin, navigate]);

  useEffect(() => {
    if (isEdit && selectedScenario) {
      const fields = [
        "scenarioName",
        "template",
        "scenarioPrompt",
        "aiAvatarRole",
        "aiInstructions",
        "aiQuestions",
        "difficulty",
        "status",
        "description",
        "permissions",
      ];
      fields.forEach((field) => setValue(field, selectedScenario[field] || ""));

      if (selectedScenario.animationTriggers) {
        setShoulderTags(selectedScenario.animationTriggers.shoulder || []);
        setNeckTags(selectedScenario.animationTriggers.neck || []);
      }

      if (selectedScenario.apiKey) {
        setCurrentApiKey(selectedScenario.apiKey);
      }
    }
  }, [isEdit, selectedScenario, setValue]);

  useEffect(() => {
    setValue("animationTriggers.shoulder", shoulderTags);
    setValue("animationTriggers.neck", neckTags);
  }, [shoulderTags, neckTags, setValue]);

  // --- AI Interaction ---
  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!aiInput) return;

    setIsAiLoading(true);

    try {
      let response;

      if (isEdit) {
        const payload = {
          scenarioId: id,
          apiKey: currentApiKey,
          userInput: aiInput,
        };
        // REPLACE WITH ACTUAL EDIT API
        response = await axios.post("YOUR_EDIT_AI_API_ENDPOINT", payload);
      } else {
        const payload = {
          educatorId: user._id || user.id,
          userInput: aiInput,
        };
        // REPLACE WITH ACTUAL CREATE API
        response = await axios.post("YOUR_CREATE_AI_API_ENDPOINT", payload);
      }

      const { apiKey, json } = response.data;

      if (apiKey) {
        setCurrentApiKey(apiKey);
      }

      if (json) {
        if (json.scenarioName) setValue("scenarioName", json.scenarioName);
        if (json.description) setValue("description", json.description);
        if (json.scenarioPrompt)
          setValue("scenarioPrompt", json.scenarioPrompt);
        if (json.aiAvatarRole) setValue("aiAvatarRole", json.aiAvatarRole);
        if (json.aiInstructions)
          setValue("aiInstructions", json.aiInstructions);
        if (json.aiQuestions) setValue("aiQuestions", json.aiQuestions);
        if (json.difficulty) setValue("difficulty", json.difficulty);
        if (json.status) setValue("status", json.status); // AI can update status

        if (json.animationTriggers) {
          if (json.animationTriggers.shoulder)
            setShoulderTags(json.animationTriggers.shoulder);
          if (json.animationTriggers.neck)
            setNeckTags(json.animationTriggers.neck);
        }
      }

      setAiInput("");
    } catch (error) {
      console.error("Error calling AI Service:", error);
      alert("Failed to process AI request. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const onSubmit = async (data) => {
    const finalData = {
      ...data,
      creator: user?.name || "Unknown",
      apiKey: currentApiKey,
      animationTriggers: {
        shoulder: shoulderTags,
        neck: neckTags,
      },
    };

    try {
      if (isEdit) {
        await dispatch(updateScenario({ id, updates: finalData })).unwrap();
      } else {
        await dispatch(addScenario(finalData)).unwrap();
      }
      navigate("/scenarios");
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Error saving scenario.");
    }
  };

  if (!isEducator && !isSchoolAdmin) return null;

  // --- COMMON STYLES FOR READ-ONLY FIELDS ---
  const readOnlyClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-sm bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none";
  const disabledContainerClass = "opacity-60 pointer-events-none"; // Disables clicks on divs/selects

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Header */}
      <div className="w-full max-w-4xl mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate("/scenarios")}
          className="flex items-center text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-lg border shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </button>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={reduxLoading || isAiLoading}
          className="px-6 py-2 rounded-lg bg-[#F59E0B] text-white text-sm font-bold hover:bg-amber-600 shadow-md transition-colors disabled:opacity-50"
        >
          {reduxLoading
            ? "Saving..."
            : isEdit
            ? "Save Scenario"
            : "Publish Scenario"}
        </button>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative pb-24">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            {watch("status")}
          </span>
        </div>

        <form className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Scenario Name (Read Only)
            </label>
            <input
              {...register("scenarioName", { required: true })}
              className={readOnlyClass}
              readOnly
              placeholder="Waiting for AI generation..."
            />
          </div>

          {!isSchoolAdmin && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">
                  Scenario Prompt (Read Only)
                </label>
                <textarea
                  {...register("scenarioPrompt")}
                  rows={3}
                  className={readOnlyClass}
                  readOnly
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-2">
                    AI Avatar Role (Read Only)
                  </label>
                  <input
                    {...register("aiAvatarRole")}
                    className={readOnlyClass}
                    readOnly
                  />
                </div>
                <div className={disabledContainerClass}>
                  <label className="block text-xs font-bold text-gray-900 mb-2">
                    Difficulty (Read Only)
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {["Low", "Medium", "High"].map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                          currentDifficulty === level
                            ? "bg-white shadow-sm"
                            : "text-gray-500"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">
                  Instructions (Read Only)
                </label>
                <textarea
                  {...register("aiInstructions")}
                  rows={2}
                  className={readOnlyClass}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">
                  Questions (Read Only)
                </label>
                <textarea
                  {...register("aiQuestions")}
                  rows={2}
                  className={readOnlyClass}
                  readOnly
                />
              </div>

              {/* Animation Triggers (Read Only - Dropdowns disabled, delete buttons hidden) */}
              <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  Animation Triggers (Read Only)
                </h3>

                {/* Shoulder */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className={disabledContainerClass}>
                    <select className="w-full px-4 py-2 rounded-lg border text-sm bg-gray-200 text-gray-500">
                      <option value="">
                        + Add Shoulder Animation (Disabled)
                      </option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {shoulderTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700"
                      >
                        {tag} {/* Delete button removed */}
                      </span>
                    ))}
                    {shoulderTags.length === 0 && (
                      <span className="text-xs text-gray-400 italic">
                        No animations generated yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Neck */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className={disabledContainerClass}>
                    <select className="w-full px-4 py-2 rounded-lg border text-sm bg-gray-200 text-gray-500">
                      <option value="">+ Add Neck Animation (Disabled)</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {neckTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700"
                      >
                        {tag} {/* Delete button removed */}
                      </span>
                    ))}
                    {neckTags.length === 0 && (
                      <span className="text-xs text-gray-400 italic">
                        No animations generated yet
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Description (Read Only)
            </label>
            <textarea
              {...register("description")}
              rows={2}
              className={readOnlyClass}
              readOnly
            />
          </div>
        </form>

        {/* Floating AI Bar - THIS REMAINS ACTIVE */}
        {!isSchoolAdmin && (
          <div className="absolute bottom-8 left-8 right-8">
            <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-[#FF9D80] via-[#FF66C4] to-[#9F7AEA] shadow-lg">
              <div className="bg-white rounded-[10px] flex items-center pr-2">
                <div className="pl-3 text-gray-400">
                  {isAiLoading ? (
                    <Loader className="w-4 h-4 animate-spin text-purple-600" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI(e)}
                  disabled={isAiLoading}
                  placeholder={
                    isAiLoading
                      ? "AI is processing..."
                      : "Ask AI to generate the form content..."
                  }
                  className="w-full px-3 py-3 text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
                <button
                  onClick={handleAskAI}
                  disabled={isAiLoading || !aiInput}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-white transition-colors ${
                    isAiLoading ? "bg-gray-400" : "bg-black hover:bg-gray-800"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenarioFormPage;
