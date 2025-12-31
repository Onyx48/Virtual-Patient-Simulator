import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/AuthContext.jsx";
import { toast } from 'react-hot-toast';
import axios from 'axios';

const initialUserData = {
  profilePictureUrl: "https://via.placeholder.com/150/FF5733/FFFFFF?text=JD",
  fullName: "John Doe",
  email: "johndoe123@gmail.com",
  phoneNumber: "+123456789",
  twoFactorEnabled: true,
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

const ToggleSwitch = ({ enabled, onToggle, disabled }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onToggle}
    disabled={disabled}
    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
      enabled && !disabled ? "bg-blue-600" : "bg-gray-200"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    role="switch"
    aria-checked={enabled}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
        enabled && !disabled ? "translate-x-5" : "translate-x-0"
      }`}
    ></span>
  </button>
);

function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [userData, setUserData] = useState(initialUserData);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailData, setEmailData] = useState({
    newEmail: '',
    password: '',
  });

  // Role-based permissions
  const isSuperadmin = user?.role === 'superadmin';

  // All roles can edit personal info
  const canEditPersonalInfo = true;
  // Can edit two-factor
  const canEditTwoFactor = isSuperadmin;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: userData,
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const twoFactorEnabled = watch("twoFactorEnabled");

  useEffect(() => {
    if (user) {
      setUserData({
        profilePictureUrl: user.profilePicture ? `http://localhost:5001${user.profilePicture}` : initialUserData.profilePictureUrl,
        fullName: user.name || initialUserData.fullName,
        email: user.email || initialUserData.email,
        phoneNumber: user.phoneNumber || initialUserData.phoneNumber,
        twoFactorEnabled: user.twoFactorEnabled ?? initialUserData.twoFactorEnabled,
      });
      setValue("fullName", user.name || initialUserData.fullName);
      setValue("email", user.email || initialUserData.email);
      setValue("phoneNumber", user.phoneNumber || initialUserData.phoneNumber);
      setValue("twoFactorEnabled", user.twoFactorEnabled ?? initialUserData.twoFactorEnabled);
    }
  }, [user, setValue]);

  const onSubmit = async (data) => {
    try {
      const response = await axios.put('/api/auth/profile', {
        name: data.fullName,
        phoneNumber: data.phoneNumber,
      });
      updateProfile({
        name: response.data.name,
        phoneNumber: response.data.phoneNumber,
      });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, and GIF files are allowed");
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB
        toast.error("File size must be less than 2MB");
        return;
      }

      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserData({ ...userData, profilePictureUrl: reader.result });
      };
      reader.readAsDataURL(file);

      // Upload
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('profilePicture', file);
        const response = await axios.post('/api/auth/upload-profile-picture', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        updateProfile({ profilePicture: response.data.profilePicture });
        toast.success("Profile picture updated successfully");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(error.response?.data?.message || "Failed to upload profile picture");
        // Reset to original
        setUserData({ ...userData, profilePictureUrl: user?.profilePicture ? `http://localhost:5001${user.profilePicture}` : initialUserData.profilePictureUrl });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      await axios.delete('/api/auth/profile-picture');
      updateProfile({ profilePicture: null });
      setUserData({ ...userData, profilePictureUrl: initialUserData.profilePictureUrl });
      toast.success("Profile picture removed successfully");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error(error.response?.data?.message || "Failed to remove profile picture");
    }
  };

  const handlePasswordSubmit = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await axios.put('/api/auth/change-password', passwordData);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success("Password updated successfully");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(error.response?.data?.message || "Failed to update password");
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put('/api/auth/change-email', emailData);
      updateProfile({ email: response.data.email });
      setEmailData({ newEmail: '', password: '' });
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
        <div className="flex items-center space-x-6">
          <img
            src={userData.profilePictureUrl}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover"
          />
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
                  uploading || !canEditPersonalInfo ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
                }`}
              >
                {uploading ? "Uploading..." : "Change Picture"}
              </label>
              <button
                type="button"
                onClick={handleRemoveProfilePicture}
                disabled={uploading || !canEditPersonalInfo}
                className={`px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md ${
                  uploading || !canEditPersonalInfo ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-300"
                }`}
              >
                Remove
              </button>
            </div>
            <p className="text-sm text-gray-500">
              JPG, GIF or PNG. Max size of 2MB.
            </p>
          </div>
        </div>

        {/* Personal Information Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="flex items-center">
                <input
                  {...register("fullName", { required: "Full name is required" })}
                  type="text"
                  disabled={!canEditPersonalInfo}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !canEditPersonalInfo ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                />
                {canEditPersonalInfo && <EditIcon />}
              </div>
              {errors.fullName && (
                <p className="text-sm text-red-600 mt-1">{errors.fullName.message}</p>
              )}
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
                <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="flex items-center">
                <input
                  {...register("phoneNumber")}
                  type="text"
                  disabled={!canEditPersonalInfo}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !canEditPersonalInfo ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                />
                {canEditPersonalInfo && <EditIcon />}
              </div>
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        {canEditTwoFactor && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Enable two-factor authentication</p>
                <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <ToggleSwitch
                enabled={twoFactorEnabled}
                onToggle={() => setValue("twoFactorEnabled", !twoFactorEnabled)}
                disabled={!canEditTwoFactor}
              />
            </div>
          </div>
        )}

        {/* Save Button */}
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
    {/* Change Password Section */}
    <div className="max-w-4xl mx-auto mt-6 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
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
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
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
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
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

    {/* Change Email Modal */}
    <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 ${showChangeEmailModal ? '' : 'hidden'}`}>
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
                onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
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
                onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
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