import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ArrowLeft, Sparkles, ArrowUp, Eye, ChevronDown } from "lucide-react";

// Redux actions (ensure these exist in your slice)
// import { addScenario, updateScenario } from '../../../redux/slices/scenarioSlice.js';

function ScenarioFormPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();

  // Select scenario if editing
  // const selectedScenario = useSelector((state) =>
  //   state.scenarios.scenarios.find(s => s.id === id)
  // );
  // For UI testing without Redux active, we use null:
  const selectedScenario = null;

  const isEdit = !!id;
  const title = isEdit ? "Edit Scenario" : "Add Scenario";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: selectedScenario || {
      scenarioName: "",
      template: "",
      scenarioPrompt: "",
      aiAvatarRole: "",
      aiInstructions: "",
      aiQuestions: "",
      difficulty: "Medium",
      status: "Draft",
      description: "",
    },
  });

  const [aiInput, setAiInput] = useState("");
  const currentDifficulty = watch("difficulty");

  // Handle Form Submission
  const onSubmit = (data) => {
    console.log("Form Submitted:", data);

    const finalData = {
      ...data,
      id: isEdit ? id : Date.now(),
      avgScore: isEdit ? selectedScenario.avgScore : "--", // Maintain mock data structure
      creator: "Alex Dorwart", // Mock user
      avgTimeSpent: "0m",
      lastUpdated: new Date().toISOString(),
    };

    // Dispatch action here
    // if (isEdit) {
    //   dispatch(updateScenario(finalData));
    // } else {
    //   dispatch(addScenario(finalData));
    // }

    // Navigate back
    navigate("/scenarios");
  };

  const handleAskAI = (e) => {
    e.preventDefault();
    if (!aiInput) return;
    console.log("Asking AI:", aiInput);
    // Mock AI response fill
    setValue("scenarioPrompt", `Generated content for: ${aiInput}`);
    setAiInput("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Top Header / Back Button */}
      <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate("/scenarios")}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            className="px-6 py-2 rounded-lg bg-[#F59E0B] text-white text-sm font-bold hover:bg-amber-600 shadow-md transition-colors"
          >
            {isEdit ? "Save Scenario" : "Publish Scenario"}
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative pb-24">
        {/* Card Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            {watch("status") || "Draft"}
          </span>
        </div>

        {/* Form Content */}
        <form className="p-8 space-y-6">
          {/* Template Selection */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-2">
                Use A Template (Optional)
              </label>
              <div className="relative">
                <select
                  {...register("template")}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm appearance-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none bg-white text-gray-700"
                >
                  <option value="">Select a template...</option>
                  <option value="negotiation">Negotiations - Pay Rise</option>
                  <option value="clinical">Clinical - Patient History</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Scenario Name */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Scenario Name
            </label>
            <input
              {...register("scenarioName", { required: true })}
              type="text"
              placeholder="Enter scenario name"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Scenario Prompt */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Scenario Prompt
            </label>
            <textarea
              {...register("scenarioPrompt")}
              rows={4}
              placeholder="Enter scenario prompt"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none resize-none placeholder:text-gray-400"
            />
          </div>

          {/* AI Avatar Role */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              AI Avatar Role
            </label>
            <input
              {...register("aiAvatarRole")}
              type="text"
              placeholder="Ex: Patient"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Instructions for AI Avatar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-900">
                Instructions For The AI Avatar
              </label>
              <a
                href="#"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                See Examples
              </a>
            </div>
            <textarea
              {...register("aiInstructions")}
              rows={3}
              placeholder="Enter instructions for the AI Avatar"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Questions for AI Feedback */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-900">
                Questions For AI Feedback
              </label>
              <a
                href="#"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                See Examples
              </a>
            </div>
            <textarea
              {...register("aiQuestions")}
              rows={3}
              placeholder="Enter questions for ai feedback"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Difficulty Level
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg w-full">
              {["Low", "Medium", "High"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue("difficulty", level)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    currentDifficulty === level
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Status
            </label>
            <div className="relative">
              <select
                {...register("status")}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm appearance-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none bg-white"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-2">
              Short Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Type here..."
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Spacer for Floating Bar */}
          <div className="h-12"></div>
        </form>

        {/* Floating Ask AI Bar */}
        <div className="absolute bottom-8 left-8 right-8">
          <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-[#FF9D80] via-[#FF66C4] to-[#9F7AEA] shadow-lg">
            <div className="bg-white rounded-[10px] flex items-center pr-2">
              <div className="pl-3 text-gray-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskAI(e)}
                placeholder="Ask anything from AI"
                className="w-full px-3 py-3 text-sm outline-none bg-transparent placeholder:text-gray-400 text-gray-800"
              />
              <button
                onClick={handleAskAI}
                className="w-8 h-8 flex items-center justify-center bg-black rounded-full text-white hover:bg-gray-800 transition-colors"
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
