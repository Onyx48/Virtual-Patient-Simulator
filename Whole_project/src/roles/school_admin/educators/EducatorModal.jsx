import React from "react";
import { useForm } from "react-hook-form";

function EducatorModal({ onSave, onClose, educatorData }) {
  const isEdit = !!educatorData;
  const title = isEdit ? "Edit Educator" : "Add New Educator";

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    defaultValues: isEdit ? educatorData : {
      educatorName: "",
      emailAddress: "",
      schoolName: "",
      numberOfStudents: "",
    },
    mode: "onBlur",
  });

  const onSubmit = (data) => {
    console.log(`Submitting ${isEdit ? 'Updated' : 'New'} Educator Form Data:`, data);

    const submissionData = {
      id: isEdit ? educatorData.id : Date.now() + Math.random(),
      educatorName: data.educatorName,
      emailAddress: data.emailAddress,
      schoolName: data.schoolName,
      numberOfStudents: data.numberOfStudents,
    };

    if (onSave) {
      onSave(submissionData);
    }

    reset();
    onClose();
  };

  const handleDiscardOrClose = () => {
    console.log(`Discarding ${isEdit ? 'changes' : 'new educator'} or closing form`);
    reset();
    onClose();
  };

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
          {isDirty && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
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
            htmlFor="educatorName"
            className="block text-sm font-medium text-gray-700"
          >
            Educator Name
          </label>
          <input
            type="text"
            id="educatorName"
            {...register("educatorName", {
              required: "Educator Name is required",
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.educatorName && (
            <p className="mt-1 text-xs text-red-600">
              {errors.educatorName.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="emailAddress"
            className="block text-sm font-medium text-gray-700"
          >
            Email Address
          </label>
          <input
            type="email"
            id="emailAddress"
            {...register("emailAddress", {
              required: "Email is required",
              pattern: /^\S+@\S+\.\S+$/i,
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.emailAddress && (
            <p className="mt-1 text-xs text-red-600">
              {errors.emailAddress.message || "Invalid email format"}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="schoolName"
            className="block text-sm font-medium text-gray-700"
          >
            School Name
          </label>
          <input
            type="text"
            id="schoolName"
            {...register("schoolName")}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="numberOfStudents"
            className="block text-sm font-medium text-gray-700"
          >
            Number of Students
          </label>
          <input
            type="number"
            id="numberOfStudents"
            {...register("numberOfStudents")}
            placeholder="e.g., 25"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

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
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
            disabled={!isDirty}
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

export default EducatorModal;