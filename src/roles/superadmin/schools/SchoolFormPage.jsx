import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../../../components/ui/react-datepicker-custom.css";
import { format, isValid, parse } from "date-fns";
import axios from "axios";
import { ChevronLeftIcon, EyeIcon } from "@heroicons/react/24/outline";
import { toast } from 'react-hot-toast';

function SchoolFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;



  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      status: "Active",
      subscriptionType: "Basic",
      permissions: "Read Only",
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    // Validate start date is before end date
    if (
      isValid(data.startDate) &&
      isValid(data.endDate) &&
      data.endDate < data.startDate
    ) {
      toast.error("Start date must be before end date.");
      setIsSubmitting(false);
      return;
    }

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
        const response = await axios.put(`/api/schools/${id}`, submissionData);

      } else {
        const response = await axios.post("/api/schools", submissionData);

      }
      navigate("/schools");
    } catch (err) {
      console.error('Submission error:', err);
      console.error('Response data:', err.response?.data);
      console.error('Response status:', err.response?.status);
      toast.error(
        err.response?.data?.message ||
          `Failed to ${isEdit ? "update" : "add"} school.`
      );
    }
  };

  // Fetch school data for edit mode
  useEffect(() => {

    if (isEdit && id) {
      const fetchSchool = async () => {
        try {
    
          const response = await axios.get(`/api/schools/${id}`);
          const schoolData = response.data;
    

          // Parse dates from string to Date objects
          const parsedStart = schoolData.startDate ? parse(schoolData.startDate, "dd/MM/yyyy", new Date()) : null;
          const parsedEnd = schoolData.expireDate ? parse(schoolData.expireDate, "dd/MM/yyyy", new Date()) : null;

          const parsedData = {
            ...schoolData,
            startDate: isValid(parsedStart) ? parsedStart : null,
            endDate: isValid(parsedEnd) ? parsedEnd : null,
          };

          if (!isValid(parsedStart) && schoolData.startDate) {

          }
          if (!isValid(parsedEnd) && schoolData.expireDate) {

          }

          reset(parsedData);
        } catch (err) {
          console.error('Fetch error:', err);
          toast.error("Failed to load school details.");
          navigate("/schools"); // Redirect back if fetch fails
        } finally {
          setIsLoading(false);
        }
      };
      fetchSchool();
    } else {
      setIsLoading(false);
    }
  }, [id, isEdit, reset, navigate]);

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
             onClick={() => setIsPreviewOpen(true)}
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
            {(() => {
              const currentStatus = watch()?.status || (isEdit ? "Active" : "Draft");
              return (
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
              );
            })()}
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
                 {...register("emailAddress", {
                   required: "Email is required",
                   pattern: {
                     value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                     message: "Please enter a valid email address"
                   }
                 })}
                 className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-shadow"
               />
               {errors.emailAddress && (
                 <p className="text-red-500 text-xs mt-1">
                   {errors.emailAddress.message}
                 </p>
               )}
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
                      showYearDropdown={true}
                      showMonthDropdown={true}
                      dropdownMode="select"
                      yearDropdownItemNumber={10}
                      monthDropdownItemNumber={12}
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
                      showYearDropdown={true}
                      showMonthDropdown={true}
                      dropdownMode="select"
                      yearDropdownItemNumber={10}
                      monthDropdownItemNumber={12}
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
             <input type="hidden" {...register("permissions")} value="Read Only" />
             <input type="hidden" {...register("subscriptionType")} value="Basic" />
          </form>
        </div>
      </main>

      {/* Preview Modal */}
      {isPreviewOpen && (() => {
        const watchedData = watch();
        return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">School Preview</h2>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* School Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">School Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">School Name</label>
                    <p className="text-gray-900">{watchedData.schoolName || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email Address</label>
                    <p className="text-gray-900">{watchedData.emailAddress || 'Not set'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-600">Short Description</label>
                  <p className="text-gray-900">{watchedData.shortDescription || 'Not set'}</p>
                </div>
              </div>

              {/* Subscription */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Subscription</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Subscription Type</label>
                    <p className="text-gray-900">{watchedData.subscriptionType || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Duration</label>
                    <p className="text-gray-900">{watchedData.duration || 'Not set'}</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Start Date</label>
                    <p className="text-gray-900">
                      {watchedData.startDate ? format(watchedData.startDate, "dd/MM/yyyy") : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">End Date</label>
                    <p className="text-gray-900">
                      {watchedData.endDate ? format(watchedData.endDate, "dd/MM/yyyy") : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status and Permissions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <p className="text-gray-900">{watchedData.status || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Permissions</label>
                    <p className="text-gray-900">{watchedData.permissions || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default SchoolFormPage;
