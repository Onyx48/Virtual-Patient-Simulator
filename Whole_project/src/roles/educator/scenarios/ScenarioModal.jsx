import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { X, Sparkles, ArrowUp, Eye } from "lucide-react";

function ScenarioModal({ onSave, onClose, scenarioData }) {
  const isEdit = !!scenarioData;
  const title = isEdit ? "Edit Scenario" : "Add Scenario";

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    defaultValues: isEdit
      ? scenarioData
      : {
          scenarioName: "",
          scenarioPrompt: "", // New field from image
          aiAvatarRole: "", // New field from image
          questions: "", // New field from image
          difficulty: "Medium", // New field from image
          status: "Draft",
          description: "", // Short description
        },
  });

  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Watch difficulty for conditional styling
  const currentDifficulty = watch("difficulty");

  const onSubmit = (data) => {
    const submissionData = {
      id: isEdit ? scenarioData.id : null,
      ...data,
      // Ensure we keep legacy fields if needed or default them
      avgScore: isEdit ? scenarioData.avgScore : "--",
      creator: isEdit ? scenarioData.creator : "Current User",
    };
    if (onSave) onSave(submissionData);
  };

  // --- API for Ask AI ---
  const handleAskAI = async () => {
    if (!aiInput.trim()) return;

    setIsAiLoading(true);
    try {
      // API CALL ADDRESS
      const response = await fetch("https://api.sit-tech.edu/v1/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiInput }),
      });

      const result = await response.json();
      console.log("AI Response:", result);
      // Assuming result comes back as text, you might want to fill a field
      // setValue("description", result.text);
      setAiInput(""); // Clear input
    } catch (error) {
      console.error("AI Error:", error);
      // For demo purposes, let's simulate a success after a delay
      setTimeout(() => {
        console.log("Simulated AI Response for:", aiInput);
        setAiInput("");
        setIsAiLoading(false);
      }, 1500);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {isEdit && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                scenarioData?.status === "Published"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {scenarioData?.status || "Draft"}
            </span>
          )}
          {!isEdit && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Draft
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <form
          id="scenarioForm"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Template Dropdown (Only for Add) */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                Use A Template (Optional)
              </label>
              <select className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all">
                <option>Negotiations - Pay Rise</option>
                <option>Clinical - Patient History</option>
              </select>
            </div>
          )}

          {/* Scenario Name */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Scenario Name
            </label>
            <input
              type="text"
              {...register("scenarioName", { required: true })}
              placeholder="Enter scenario name"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Scenario Prompt */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Scenario Prompt
            </label>
            <textarea
              rows={3}
              {...register("scenarioPrompt")}
              placeholder="Enter scenario prompt"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none placeholder:text-gray-400"
            />
          </div>

          {/* AI Avatar Role */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              AI Avatar Role
            </label>
            <input
              type="text"
              {...register("aiAvatarRole")}
              placeholder="e.g. Patient"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Questions for AI Feedback */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-900">
                Questions For AI Feedback
              </label>
              <span className="text-xs text-blue-600 cursor-pointer font-medium hover:underline">
                See Examples
              </span>
            </div>
            <textarea
              rows={3}
              {...register("questions")}
              placeholder="Enter questions for ai feedback"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Difficulty Level
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {["Low", "Medium", "High"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue("difficulty", level)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    currentDifficulty === level
                      ? "bg-white text-black shadow-sm"
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
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Status
            </label>
            <select
              {...register("status")}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none bg-white"
            >
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Short Description
            </label>
            <textarea
              rows={3}
              {...register("description")}
              placeholder="Type here..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Spacer for the floating gradient bar */}
          <div className="h-16"></div>
        </form>
      </div>

      {/* Floating Ask AI Bar (Gradient) */}
      <div className="absolute bottom-[80px] left-0 right-0 px-8">
        <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-[#FF9D80] via-[#FF66C4] to-[#9F7AEA] shadow-lg">
          <div className="bg-white rounded-[10px] flex items-center pr-2">
            <div className="pl-3 text-gray-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask anything from AI"
              disabled={isAiLoading}
              className="w-full px-3 py-3 text-sm outline-none bg-transparent placeholder:text-gray-400 text-gray-800"
              onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
            />
            <button
              onClick={handleAskAI}
              disabled={isAiLoading}
              className="w-8 h-8 flex items-center justify-center bg-black rounded-full text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="px-8 py-5 border-t border-gray-100 bg-white flex items-center justify-between z-20">
        <button className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button
          type="submit"
          form="scenarioForm"
          className="px-8 py-2.5 rounded-lg bg-[#F59E0B] text-white text-sm font-semibold hover:bg-amber-600 shadow-md shadow-orange-500/20 transition-all"
        >
          {isEdit ? "Save Scenario" : "Publish Scenario"}
        </button>
      </div>
    </div>
  );
}

export default ScenarioModal;
