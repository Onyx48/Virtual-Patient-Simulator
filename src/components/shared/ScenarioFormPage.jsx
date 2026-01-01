import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../AuthContext";
import axios from "axios";
import { addScenario } from "../../redux/slices/scenarioSlice.js";
import {
  ArrowLeft,
  Sparkles,
  ArrowUp,
  Loader,
  X,
  AlertCircle,
} from "lucide-react";
// --- CONFIGURATION ---
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8888";
// --- INTERNAL COMPONENT: ERROR POPUP ---
const ErrorModal = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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

function ScenarioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  // Access Redux just for the list data
  const { scenarios } = useSelector((state) => state.scenarios);
  const dispatch = useDispatch();
  // --- 1. DETERMINE MODE (DB EDIT vs NEW) ---
  const selectedScenario = id
    ? scenarios.find((s) => s._id === id || s.id === id)
    : null;
  const isDbEdit = !!id;
  const title = isDbEdit
    ? "Edit Scenario (AI Generated Only)"
    : "Add Scenario (AI Generated Only)";
  // --- 2. FORM SETUP ---
  const { register, handleSubmit, setValue, watch } = useForm({
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
  // --- 3. LOCAL STATE ---
  const [shoulderTags, setShoulderTags] = useState([]);
  const [neckTags, setNeckTags] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [aiGeneratedId, setAiGeneratedId] = useState(null);
  // Error Popup State
  const [errorPopup, setErrorPopup] = useState({ open: false, message: "" });
  const currentDifficulty = watch("difficulty");
  const isSchoolAdmin = user?.role === "school_admin";
  const isEducator = user?.role === "educator";
  // --- 4. EFFECTS ---
  // Redirect if not authorized
  useEffect(() => {
    if (!isEducator && !isSchoolAdmin) navigate("/dashboard");
  }, [isEducator, isSchoolAdmin, navigate]);
  // Load Data if Editing Existing Scenario
  useEffect(() => {
    if (isDbEdit && selectedScenario) {
      console.log("Loading Existing Scenario Data...", selectedScenario);
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
  }, [isDbEdit, selectedScenario, setValue]);
  // Sync Tags with Form
  useEffect(() => {
    setValue("animationTriggers.shoulder", shoulderTags);
    setValue("animationTriggers.neck", neckTags);
  }, [shoulderTags, neckTags, setValue]);
  // --- 5. AI INTERACTION HANDLER ---
  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!aiInput) return;
    console.log("--- STARTING AI REQUEST ---");
    setIsAiLoading(true);

    try {
      let response;
      const headers = { "Content-Type": "application/json" };

      if (currentApiKey) {
        // --- EDIT MODE ---
        const url = `${AI_SERVICE_URL}/edit-scenario`;
        const payload = { api_key: currentApiKey, scenario_prompt: aiInput };
        console.log(`Sending POST to ${url}`);
        response = await axios.post(url, payload, { headers });
      } else {
        // --- ADD MODE ---
        const url = `${AI_SERVICE_URL}/add-scenario`;
        const payload = {
          educator_id: user?._id || user?.id,
          scenario_prompt: aiInput,
        };
        console.log(`Sending POST to ${url}`);
        response = await axios.post(url, payload, { headers });
      }

      console.log("--- AI RESPONSE RECEIVED ---");
      const rawData = response.data;
      const actualData = rawData.response ? rawData.response : rawData;
      console.log("Unwrapped Data:", actualData);

      const returnedApiKey = actualData.apiKey || actualData.api_key;
      const returnedJson = actualData.json || actualData;

      if (returnedApiKey) {
        setCurrentApiKey(returnedApiKey);
      }

      if (returnedJson) {
        if (returnedJson._id) {
          setAiGeneratedId(returnedJson._id);
        }

        // Map Name
        if (returnedJson.scenarioName || returnedJson.scenario_name) {
          const name = returnedJson.scenarioName || returnedJson.scenario_name;
          setValue("scenarioName", name);
          setValue("description", name);
        }

        if (returnedJson.scenarioPrompt || returnedJson.scenario_prompt)
          setValue(
            "scenarioPrompt",
            returnedJson.scenarioPrompt || returnedJson.scenario_prompt
          );

        // Map Questions
        const questions =
          returnedJson.aiQuestions ||
          returnedJson.ai_questions ||
          returnedJson.questions_for_feedback;
        if (questions) {
          const val = Array.isArray(questions)
            ? questions.join("\n")
            : questions;
          setValue("aiQuestions", val);
        }

        if (returnedJson.difficulty || returnedJson.difficulty_level)
          setValue(
            "difficulty",
            returnedJson.difficulty || returnedJson.difficulty_level
          );

        if (returnedJson.status) setValue("status", returnedJson.status);

        // Animation Triggers
        const triggers =
          returnedJson.animationTriggers || returnedJson.animation_triggers;
        if (triggers) {
          if (triggers.shoulder) setShoulderTags(triggers.shoulder);
          if (triggers.neck) setNeckTags(triggers.neck);
        }
      }
      setAiInput("");
    } catch (error) {
      console.error("--- AI REQUEST FAILED ---");
      const msg = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      setErrorPopup({ open: true, message: `AI Error: ${msg}` });
    } finally {
      setIsAiLoading(false);
    }
  };
  // --- 6. SUBMIT HANDLER (UPDATED TOKEN LOGIC) ---
  const onSubmit = async (data) => {
    setIsSaving(true);

    const finalData = {
      ...data,
      creator: user?.name || "Unknown",
      apiKey: currentApiKey,
      animationTriggers: {
        shoulder: shoulderTags,
        neck: neckTags,
      },
    };

    if (!isDbEdit && aiGeneratedId) {
      finalData._id = aiGeneratedId;
    }

    try {
      if (isDbEdit) {
        // For edit, keep direct axios since no Redux update thunk
        const token = localStorage.getItem("token") || (localStorage.getItem("userInfo") && JSON.parse(localStorage.getItem("userInfo"))?.token);
        if (!token) {
          throw new Error("Authentication token missing. Please log out and log back in.");
        }
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        };
        await axios.put(`/api/scenarios/${id}`, finalData, config);
      } else {
        await dispatch(addScenario(finalData)).unwrap();
      }
      // Navigate on success
      navigate("/scenarios");
    } catch (err) {
      console.error("Failed to save to DB:", err);
      let errMsg = "Unknown error occurred";
      if (err.response?.data?.errors) {
        errMsg = err.response.data.errors.map(e => e.msg).join(", ");
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      } else {
        errMsg = err.message;
      }
      setErrorPopup({ open: true, message: errMsg });
    } finally {
      setIsSaving(false);
    }
  };
  if (!isEducator && !isSchoolAdmin) return null;
  // --- STYLES ---
  const readOnlyClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-sm bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none";
  const disabledContainerClass = "opacity-60 pointer-events-none";
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Error Popup Component */}
      <ErrorModal
        isOpen={errorPopup.open}
        message={errorPopup.message}
        onClose={() => setErrorPopup({ ...errorPopup, open: false })}
      />
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
          disabled={isSaving || isAiLoading}
          className="px-6 py-2 rounded-lg bg-[#F59E0B] text-white text-sm font-bold hover:bg-amber-600 shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving && <Loader className="w-4 h-4 animate-spin" />}
          {isSaving
            ? "Saving..."
            : isDbEdit
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

           {/* Grid: Difficulty Only */}
           <div className="grid grid-cols-1 gap-6">
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
               Questions (Read Only)
             </label>
             <textarea
               {...register("aiQuestions")}
               rows={4}
               className={readOnlyClass}
               readOnly
             />
           </div>

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
      </div>
    </div>
  );
}
export default ScenarioFormPage;
