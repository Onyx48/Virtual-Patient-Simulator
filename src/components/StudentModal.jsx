import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { XMarkIcon } from "@heroicons/react/24/outline";

function StudentModal({
  onSave,
  onClose,
  studentData,
  role,
  defaultSchoolName,
  groups = [],
}) {
  const isEdit = !!studentData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMode, setGroupMode] = useState(
    studentData?.groupId ? "existing" : "none",
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: isEdit
      ? {
          studentName: studentData.name,
          emailAddress: studentData.email,
          schoolName: studentData.schoolName,
          grade: "",
          groupId: studentData.groupId?._id || studentData.groupId || "",
          newGroupName: "",
        }
      : {
          studentName: "",
          emailAddress: "",
          schoolName: role === "educator" ? defaultSchoolName : "",
          grade: "",
          groupId: "",
          newGroupName: "",
        },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const submissionData = {
      id: studentData?.id,
      user_id: studentData?.user_id,
      name: data.studentName,
      email: data.emailAddress,
      schoolName:
        !isEdit && role === "educator" ? defaultSchoolName : data.schoolName,
      grade: data.grade,
    };

    if (groupMode === "existing" && data.groupId) {
      submissionData.groupId = data.groupId;
    } else if (groupMode === "new" && data.newGroupName?.trim()) {
      submissionData.newGroupName = data.newGroupName.trim();
    }

    await onSave(submissionData);
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? "Edit Student Details" : "Add New Student"}
        </h2>
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
            Full Name
          </label>
          <input
            type="text"
            {...register("studentName", { required: "Name is required" })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
            placeholder="e.g. Tatiana Baptista"
          />
          {errors.studentName && (
            <p className="text-xs text-red-500">{errors.studentName.message}</p>
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

        <div className="grid grid-cols-2 gap-5">
          {!(role === "educator" && !isEdit) && (
            <div className="space-y-1.5 col-span-2">
              <label className="block text-sm font-semibold text-gray-700">
                School Name
              </label>
              <input
                type="text"
                {...register("schoolName")}
                readOnly={role === "educator"}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
                placeholder="School Name"
              />
            </div>
          )}
        </div>

        {/* Group assignment — only for educators */}
        {role === "educator" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Group Assignment
            </label>
            <div className="flex gap-3">
              {[
                { value: "none", label: "No group" },
                { value: "existing", label: "Existing group" },
                { value: "new", label: "Create new group" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGroupMode(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    groupMode === opt.value
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {groupMode === "existing" && (
              <div className="space-y-1.5">
                {groups.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No groups yet. Create one using "Create new group".
                  </p>
                ) : (
                  <select
                    {...register("groupId")}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm bg-white"
                  >
                    <option value="">— Select a group —</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                        {g.studentCount != null
                          ? ` (${g.studentCount} student${g.studentCount !== 1 ? "s" : ""})`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {groupMode === "new" && (
              <div className="space-y-1.5">
                <input
                  type="text"
                  {...register("newGroupName")}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm"
                  placeholder="e.g. Morning Cohort A"
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg"
          >
            {isSubmitting
              ? "Saving..."
              : isEdit
                ? "Update Student"
                : "Create Student"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StudentModal;
