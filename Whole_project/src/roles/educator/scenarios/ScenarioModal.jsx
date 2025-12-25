import React from "react";
import { useForm, Controller } from "react-hook-form";

// import closeIconPng from '../path/to/close.png';

function ScenarioModal({ onSave, onClose, scenarioData }) {
  const isEdit = !!scenarioData;
  const title = isEdit ? "Edit Scenario" : "Add New Scenario";

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    defaultValues: isEdit ? scenarioData : {
      scenarioName: "",
      description: "",
      creator: "",
      avgTimeSpent: "",
      status: "Draft",
      permissions: "Read Only",
    },
    mode: "onBlur",
  });

  const onSubmit = (data) => {
    console.log(`Submitting ${isEdit ? 'Updated' : 'New'} Scenario Form Data:`, data);
    const submissionData = {
      id: isEdit ? scenarioData.id : Date.now() + Math.random(),
      scenarioName: data.scenarioName,
      description: data.description,
      creator: data.creator,
      avgTimeSpent: data.avgTimeSpent,
      status: data.status,
      permissions: data.permissions,
    };

    if (onSave) {
      onSave(submissionData);
    }

    reset();
    onClose();
  };

  const handleDiscardOrClose = () => {
    console.log(`Discarding ${isEdit ? 'changes' : 'new scenario'} or closing form`);
    reset();
    onClose();
  };

  const ChevronDownIcon = () => (
    <svg
      className="fill-current h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
    >
      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
    </svg>
  );

  const CloseIcon = () => (
    <svg
      className="w-5 h-5 text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      ></path>
    </svg>
  );

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-4 p-6">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold mr-2">{title}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Published
          </span>

          {isDirty && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
              Unsaved
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={handleDiscardOrClose}
            className="p-1 rounded-full hover:bg-gray-100 focus:outline-none"
            title="Close"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4 px-6">
        <div className="grid gap-2">
          <label
            htmlFor="scenarioName"
            className="block text-sm font-medium text-gray-700"
          >
            Scenario Name
          </label>
          <input
            type="text"
            id="scenarioName"
            {...register("scenarioName", {
              required: "Scenario Name is required",
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.scenarioName && (
            <p className="mt-1 text-xs text-red-600">
              {errors.scenarioName.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="description"
            {...register("description")}
            rows="3"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
          ></textarea>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="creator"
            className="block text-sm font-medium text-gray-700"
          >
            Creator
          </label>
          <input
            type="text"
            id="creator"
            {...register("creator", { required: "Creator is required" })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.creator && (
            <p className="mt-1 text-xs text-red-600">
              {errors.creator.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="avgTimeSpent"
            className="block text-sm font-medium text-gray-700"
          >
            Avg. Time Spent
          </label>
          <input
            type="text"
            id="avgTimeSpent"
            {...register("avgTimeSpent")}
            placeholder="e.g., 30 Minutes"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.avgTimeSpent && (
            <p className="mt-1 text-xs text-red-600">
              {errors.avgTimeSpent.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <div className="relative">
            <select
              id="status"
              {...register("status")}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 appearance-none bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
              <option value="Archived">Archived</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <ChevronDownIcon />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="block text-sm font-medium text-gray-700">
            Permissions
          </label>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="permissions-read"
                value="Read Only"
                {...register("permissions")}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <label
                htmlFor="permissions-read"
                className="text-sm font-medium text-gray-700"
              >
                Read Only
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="permissions-write"
                value="Write Only"
                {...register("permissions")}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <label
                htmlFor="permissions-write"
                className="text-sm font-medium text-gray-700"
              >
                Write Only
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="permissions-both"
                value="Both"
                {...register("permissions")}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <label
                htmlFor="permissions-both"
                className="text-sm font-medium text-gray-700"
              >
                Both
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-2 mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-500 uppercase tracking-wider">
            All Educators
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img
                  className="h-8 w-8 rounded-full mr-3"
                  src="https://via.placeholder.com/150x150"
                  alt="Educator"
                />
                <span className="text-gray-900 text-sm font-medium">
                  Zaire Saris
                </span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
              >
                ...
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img
                  className="h-8 w-8 rounded-full mr-3"
                  src="https://via.placeholder.com/150x150"
                  alt="Educator"
                />
                <span className="text-gray-900 text-sm font-medium">
                  Allison Schleifer
                </span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
              >
                ...
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Ask anything from AI"
              className="w-full px-4 pl-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 20.125v-3.38M9.663 17a3 3 0 11-2.885-3.374L3 10.35v4.63c0 .547.24.983.562 1.182a2.24 2.24 0 01.27 1.032V17h6.838zm4.674 0a3 3 0 102.885-3.374L21 10.35v4.63c0 .547-.24.983-.562 1.182a2.24 2.24 0 00-.27 1.032V17h-6.838z"
                ></path>
              </svg>
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-600 hover:text-purple-800 focus:outline-none"
            >
              <svg
                className="h-5 w-5 transform rotate-90"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-.197a1 1 0 00.937-.807l2.003-11.008a1 1 0 00-.946-1.105z"></path>
              </svg>
            </button>
          </div>
        </div>
      </form>

      <div className="flex justify-end space-x-4 mt-6 p-6 border-t border-gray-200">
        <button
          type="button"
          onClick={handleDiscardOrClose}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium"
        >
          Discard Changes
        </button>

        <button
          type="submit"
          onClick={handleSubmit(onSubmit)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
          disabled={!isDirty}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default ScenarioModal;