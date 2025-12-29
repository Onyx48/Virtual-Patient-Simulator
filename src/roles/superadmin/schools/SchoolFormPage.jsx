import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, isValid } from "date-fns";
import axios from "axios";
import { ChevronLeftIcon, EyeIcon } from "@heroicons/react/24/outline";

function SchoolFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      schoolName: "",
      shortDescription: "",
      emailAddress: "",
      duration: "1 Year",
      startDate: null,
      endDate: null,
      status: "Active",
      permissions: "Read Only",
      subscriptionType: "Premium",
    },
  });

  const currentStatus = watch("status");

  useEffect(() => {
    if (isEdit) {
      setIsLoading(true);
      axios
        .get(`/api/schools/${id}`)
        .then((response) => {
          const data = response.data;
          reset({
            schoolName: data.schoolName,
            shortDescription: data.description,
            emailAddress: data.email,
            subscriptionType: data.subscriptionType || "Premium",
            duration: data.duration || "1 Year",
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.expireDate ? new Date(data.expireDate) : null,
            status: data.status,
            permissions: data.permissions || "Read Only",
          });
        })
        .catch((err) => {
          console.error("Failed to fetch school:", err);
          alert("Could not load school details.");
          navigate("/schools");
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, isEdit, reset, navigate]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const submissionData = {
        schoolName: data.schoolName,
        description: data.shortDescription,
        email: data.emailAddress,
        subscriptionType: data.subscriptionType,
        duration: data.duration,
        startDate: isValid(data.startDate)
          ? format(data.startDate, "dd/MM/yyyy")
          : null,
        expireDate: isValid(data.endDate)
          ? format(data.endDate, "dd/MM/yyyy")
          : null,
        status: data.status,
        permissions: data.permissions,
      };

      if (isEdit) {
        await axios.put(`/api/schools/${id}`, submissionData);
      } else {
        await axios.post("/api/schools", submissionData);
      }
      navigate("/schools");
    } catch (err) {
      alert(
        err.response?.data?.message ||
          `Failed to ${isEdit ? "update" : "add"} school.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="absolute inset-0 bg-gray-50 flex flex-col z-20 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 text-sm font-medium border border-gray-300 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Go Back
        </button>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="flex items-center text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            Preview
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? "Saving..."
              : isEdit
              ? "Save Changes"
              : "Save School"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex justify-center p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-xl p-8 h-fit">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? "Edit School" : "Add New School"}
            </h1>
            {/* Dynamic Badge */}
            <span
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                currentStatus === "Active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {isEdit
                ? currentStatus === "Active"
                  ? "Published"
                  : currentStatus
                : "Draft"}
            </span>
          </div>

          <form className="space-y-5">
            {/* School Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Name
              </label>
              <input
                type="text"
                {...register("schoolName", {
                  required: "School Name is required",
                })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-shadow"
              />
              {errors.schoolName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.schoolName.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short Description
              </label>
              <textarea
                rows="3"
                {...register("shortDescription")}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none transition-shadow"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                {...register("emailAddress", { required: "Email is required" })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-shadow"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration
              </label>
              <select
                {...register("duration")}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white transition-shadow"
              >
                <option value="1 Year">1 Year</option>
                <option value="6 Months">6 Months</option>
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <Controller
                  control={control}
                  name="startDate"
                  rules={{ required: "Required" }}
                  render={({ field }) => (
                    <DatePicker
                      selected={field.value}
                      onChange={field.onChange}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="DD/MM/YYYY"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
                    />
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <Controller
                  control={control}
                  name="endDate"
                  rules={{ required: "Required" }}
                  render={({ field }) => (
                    <DatePicker
                      selected={field.value}
                      onChange={field.onChange}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="DD/MM/YYYY"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
                    />
                  )}
                />
              </div>
            </div>

            {/* Status Dropdown - VISIBLE NOW */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                {...register("status")}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
              >
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Permissions (Still hidden as per screenshot not showing it explicitly in main flow, but kept for data) */}
            <input type="hidden" {...register("permissions")} />
            <input type="hidden" {...register("subscriptionType")} />
          </form>
        </div>
      </main>
    </div>
  );
}

export default SchoolFormPage;
