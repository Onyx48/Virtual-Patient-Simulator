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
    setValue,
    watch,
  } = useForm({
    defaultValues: scenarioData || {
      scenarioName: "",
      description: "",
      status: "Draft",
      permissions: "Read Only",
      assignedTo: [],
    },
  });

  const [assignedTo, setAssignedTo] = useState(scenarioData?.assignedTo || []);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAiBar, setShowAiBar] = useState(false);

  const handleSave = (data) => {
    onSave({ ...data, assignedTo });
  };

  const addAssignee = (email) => {
    if (email && !assignedTo.includes(email)) {
      setAssignedTo([...assignedTo, email]);
      setValue("assignedTo", [...assignedTo, email]);
    }
  };

  const removeAssignee = (email) => {
    const updated = assignedTo.filter((e) => e !== email);
    setAssignedTo(updated);
    setValue("assignedTo", updated);
  };

  const generateAiSuggestions = () => {
    // Mock AI suggestions
    const suggestions = [
      "Add interactive decision points",
      "Include patient feedback loops",
      "Enhance scenario with multimedia",
    ];
    setAiSuggestions(suggestions);
    setShowAiBar(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form id="scenario-form" onSubmit={handleSubmit(handleSave)} className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Scenario Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scenario Name *
            </label>
            <input
              type="text"
              {...register("scenarioName", { required: "Scenario name is required" })}
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter scenario name"
            />
            {errors.scenarioName && (
              <p className="mt-1 text-sm text-red-600">{errors.scenarioName.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter scenario description"
            />
          </div>

          {/* Status and Permissions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                {...register("status")}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <select
                {...register("permissions")}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="Read Only">Read Only</option>
                <option value="Write Only">Write Only</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned To (Emails)
            </label>
            <div className="space-y-2">
              {assignedTo.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const updated = [...assignedTo];
                      updated[index] = e.target.value;
                      setAssignedTo(updated);
                      setValue("assignedTo", updated);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter email"
                  />
                  <button
                    type="button"
                    onClick={() => removeAssignee(email)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addAssignee("")}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add Assignee
              </button>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" />
                AI Suggestions
              </h3>
              <button
                type="button"
                onClick={generateAiSuggestions}
                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              >
                Generate
              </button>
            </div>
            {showAiBar && (
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded border"
                  >
                    <ArrowUp size={14} className="text-green-500" />
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="scenario-form" // Assuming form id
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isEdit ? "Update Scenario" : "Create Scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScenarioModal;