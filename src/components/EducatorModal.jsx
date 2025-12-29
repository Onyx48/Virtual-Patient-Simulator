import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { XMarkIcon } from "@heroicons/react/24/outline";

function EducatorModal({ onSave, onClose, educatorData }) {
  const isEdit = !!educatorData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: isEdit
      ? {
          educatorName: educatorData.name,
          emailAddress: educatorData.email,
          department: educatorData.department,
        }
      : {
          educatorName: "",
          emailAddress: "",
          password: "",
          department: "Science",
        },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const submissionData = {
      id: educatorData?.id,
      educatorName: data.educatorName,
      emailAddress: data.emailAddress,
      password: data.password, // Only used on backend if creating new
      department: data.department,
    };

    await onSave(submissionData);
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit Educator" : "Add New Educator"}
          </h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
            Unsaved
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Educator Name
          </label>
          <input
            type="text"
            {...register("educatorName", { required: "Name is required" })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
            placeholder="e.g. Haylie Dormat"
          />
          {errors.educatorName && (
            <p className="text-xs text-red-500">
              {errors.educatorName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            {...register("emailAddress", { required: "Email is required" })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
            placeholder="name@example.com"
          />
          {errors.emailAddress && (
            <p className="text-xs text-red-500">
              {errors.emailAddress.message}
            </p>
          )}
        </div>

        {!isEdit && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Password
            </label>
            <input
              type="password"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "Min 6 chars" },
              })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Department
          </label>
          <div className="relative">
            <select
              {...register("department")}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
            >
              <option value="Science">Science</option>
              <option value="History">History</option>
              <option value="English">English</option>
              <option value="Mathematics">Mathematics</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-50 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-md"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EducatorModal;
