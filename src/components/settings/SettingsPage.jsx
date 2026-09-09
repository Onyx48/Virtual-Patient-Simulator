import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/AuthContext.jsx";
import { toast } from "react-hot-toast";
import axios from "axios";

/*
 * Placeholders for the avatar only. The name, email and phone were mock values
 * ("John Doe", "+123456789") shown whenever the account had none — so the phone
 * field arrived pre-filled with a number the user had never entered, and saving
 * the form wrote that fake number to their profile. Empty is honest, and an empty
 * field is what makes the placeholder text below visible.
 */
const initialUserData = {
  profilePictureUrl: "https://via.placeholder.com/150/FF5733/FFFFFF?text=JD",
  fullName: "",
  email: "",
  phoneNumber: "",
};

const EditIcon = () => (
  <svg
    className="w-4 h-4 text-gray-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    ></path>
  </svg>
);

const EyeIcon = ({ isVisible, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-1 rounded-full hover:bg-gray-100 focus:outline-none"
  >
    {isVisible ? (
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
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        ></path>
      </svg>
    ) : (
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
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.07 10.07 0 01.681-1.11l-.003-.002A1.105 1.105 0 013.3 9.242m2.292 5.46a3 3 0 104.243-4.243m1.765 2.47a1.313 1.313 0 01-.776-.5V7.071c0-1.006.811-1.817 1.817-1.817.552 0 1.053.247 1.406.665m0 0a1.997 1.997 0 011.414-.665C18.281 5.254 19 6.065 19 7.071v1.07a1.147 1.147 0 01-.776.51l-.776-.51zM7.172 7.172A7 7 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.07 10.07 0 01-.681 1.11l-.003.002A1.105 1.105 0 0120.7 14.758l-2.292-5.46z"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        ></path>
      </svg>
    )}
  </button>
);

function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [userData, setUserData] = useState(initialUserData);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [emailData, setEmailData] = useState({
    newEmail: "",
    password: "",
  });

  const canEditPersonalInfo = true;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: userData,
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setUserData({
        profilePictureUrl: user.profilePicture
          ? `https://vpsbackend.metawingsxr.com${user.profilePicture}`
          : initialUserData.profilePictureUrl,
        fullName: user.name || initialUserData.fullName,
        email: user.email || initialUserData.email,
        phoneNumber: user.phoneNumber || initialUserData.phoneNumber,
      });
      /*
       * reset, not setValue: setValue leaves the form's baseline at the mock
       * defaults, so the form counted as dirty the moment the real account
       * loaded and Save was enabled before anything had been edited. reset
       * moves the baseline, so `isDirty` means "the user changed something".
       */
      reset({
        fullName: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    try {
      // No `name`: it is not editable here (see the Full Name field below).
      const response = await axios.put("/api/auth/profile", {
        phoneNumber: data.phoneNumber,
      });
      updateProfile({
        name: response.data.name,
        phoneNumber: response.data.phoneNumber,
      });
      /*
       * The saved value becomes the new baseline, so Save goes back to disabled
       * and a second click cannot re-send a save that already happened.
       */
      reset({ ...data, phoneNumber: response.data.phoneNumber ?? "" });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      /*
       * express-validator answers a rejected field with { errors: [...] } and no
       * `message`, so the old line fell through to "Failed to update profile" and
       * the user was told nothing about why the number would not save.
       */
      const validation = error.response?.data?.errors?.[0]?.msg;
      toast.error(
        validation ||
          error.response?.data?.message ||
          error.message ||
          "Failed to update profile",
      );
    }
  };

  /*   const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, and GIF files are allowed");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File size must be less than 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUserData({ ...userData, profilePictureUrl: reader.result });
      };
      reader.readAsDataURL(file);

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("profilePicture", file);
        const response = await axios.post(
          "/api/auth/upload-profile-picture",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
        updateProfile({ profilePicture: response.data.profilePicture });
        toast.success("Profile picture updated successfully");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(
          error.response?.data?.message || "Failed to upload profile picture",
        );
        setUserData({
          ...userData,
          profilePictureUrl: user?.profilePicture
            ? `http://localhost:5001${user.profilePicture}`
            : initialUserData.profilePictureUrl,
        });
      } finally {
        setUploading(false);
      }
    }
  }; */

  /*   const handleRemoveProfilePicture = async () => {
    try {
      await axios.delete("/api/auth/profile-picture");
      updateProfile({ profilePicture: null });
      setUserData({
        ...userData,
        profilePictureUrl: initialUserData.profilePictureUrl,
      });
      toast.success("Profile picture removed successfully");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error(
        error.response?.data?.message || "Failed to remove profile picture",
      );
    }
  }; */

  const handlePasswordSubmit = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await axios.put("/api/auth/change-password", passwordData);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password updated successfully");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(error.response?.data?.message || "Failed to update password");
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put("/api/auth/change-email", emailData);
      updateProfile({ email: response.data.email });
      setEmailData({ newEmail: "", password: "" });
      setShowChangeEmailModal(false);
      toast.success("Email updated successfully");
    } catch (error) {
      console.error("Email change error:", error);
      toast.error(error.response?.data?.message || "Failed to update email");
    }
  };

  return (
    <div>
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Profile Picture Section */}
          {/* <div className="flex items-center space-x-6">
            {user?.profilePicture ? (
              <img
                src={userData.profilePictureUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm">No Image</span>
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  disabled={!canEditPersonalInfo}
                  className="hidden"
                  id="profile-pic"
                />
                <label
                  htmlFor="profile-pic"
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md cursor-pointer ${
                    uploading || !canEditPersonalInfo
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-blue-700"
                  }`}
                >
                  {uploading
                    ? "Uploading..."
                    : user?.profilePicture
                      ? "Change Picture"
                      : "Upload"}
                </label>
                {user?.profilePicture && (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    disabled={uploading || !canEditPersonalInfo}
                    className={`px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md ${
                      uploading || !canEditPersonalInfo
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-300"
                    }`}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">
                JPG, GIF or PNG. Max size of 2MB.
              </p>
            </div>
          </div> */}

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                {/*
                  Read-only for every role, including superadmin. The name is how
                  an educator identifies a student on a roster and how a session
                  is attributed, so it is set at account creation and changed by
                  whoever administers the account — not by its holder. `name` is
                  no longer in the submitted payload either; disabling the input
                  alone would still leave the field editable through the form
                  state.
                */}
                <div className="flex items-center">
                  <input
                    {...register("fullName")}
                    type="text"
                    disabled={true}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="flex items-center">
                  <input
                    {...register("email", { required: "Email is required" })}
                    type="email"
                    disabled={true} // Email always read-only
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(true)}
                    className="ml-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    Change Email
                  </button>
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="flex items-center">
                  <input
                    {...register("phoneNumber", {
                      pattern: {
                        // Digits, spaces and the punctuation a written number
                        // uses. Deliberately loose: numbers are international and
                        // a strict format rejects valid ones.
                        value: /^[+()\-.\s\d]{6,20}$/,
                        message:
                          "Use digits, spaces and + ( ) - only, 6 to 20 characters.",
                      },
                    })}
                    type="tel"
                    placeholder="e.g. +44 7700 900123"
                    disabled={!canEditPersonalInfo}
                    className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      !canEditPersonalInfo
                        ? "bg-gray-100 cursor-not-allowed"
                        : ""
                    }`}
                  />
                  {canEditPersonalInfo && <EditIcon />}
                </div>
                {errors.phoneNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isDirty}
              className={`px-6 py-2 text-white rounded-md ${
                isDirty
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <React.Fragment>
        <div className="max-w-4xl mx-auto mt-6 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Change Password
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter current password"
                />
                <EyeIcon
                  isVisible={showCurrentPassword}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password"
                />
                <EyeIcon
                  isVisible={showNewPassword}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm new password"
                />
                <EyeIcon
                  isVisible={showConfirmPassword}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              </div>
            </div>
            <button
              onClick={handlePasswordSubmit}
              disabled={uploading}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              Update Password
            </button>
          </div>
        </div>

        <div
          className={`fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 ${showChangeEmailModal ? "" : "hidden"}`}
        >
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Change Email</h3>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Email
                </label>
                <input
                  type="email"
                  value={emailData.newEmail}
                  onChange={(e) =>
                    setEmailData({ ...emailData, newEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={emailData.password}
                  onChange={(e) =>
                    setEmailData({ ...emailData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowChangeEmailModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Update Email
                </button>
              </div>
            </form>
          </div>
        </div>
      </React.Fragment>
    </div>
  );
}

export default SettingsPage;
