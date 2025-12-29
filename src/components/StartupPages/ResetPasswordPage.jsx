// src/components/StartupPages/ResetPasswordPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import formBgImage from "./login-bg.jpg"; // Ensure path is correct
// ... (errorIcon and validation functions for password)

function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useParams(); // If using a token in the URL: /reset-password/:token

  // Get email from location state (passed from OtpVerificationPage)
  // Or, if using a token that encodes email or can be verified by backend to get email, adjust accordingly
  const email = location.state?.email;
  const verifiedOtp = location.state?.otp; // If you passed the OTP itself (less secure than a token)

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Add password validation (e.g., min length, match confirm password)
  const validateNewPassword = () => {
    /* ... */
  };
  const validateConfirmPassword = () => {
    /* ... */
  };

  useEffect(() => {
    // Redirect if email (or token) is missing, meaning user didn't come through proper flow
    if (!email && !token) {
      // Adjust condition based on your flow (email or token)
      navigate("/login", {
        state: { message: "Invalid password reset attempt." },
      });
    }
  }, [email, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation for newPassword and confirmPassword
    // ...

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return;
    }
    // Add other password strength checks if needed

    if (passwordError || confirmPasswordError) return; // Don't submit if client errors

    setIsLoading(true);
    setApiError("");
    setSuccessMessage("");

    try {
      // The backend /api/auth/reset-password needs to know how to verify this request.
      // Option 1: Send email and the OTP that was just verified (simpler, less secure)
      // Option 2 (Better): Send email and a temporary reset token obtained from /verify-otp
      const payload = {
        email,
        newPassword,
        // otp: verifiedOtp, // If your backend expects the OTP again
        // resetToken: token, // If your backend expects a token from the URL/state
      };

      await axios.post("/api/auth/reset-password", payload);
      setSuccessMessage(
        "Password has been reset successfully! You can now log in."
      );
      // Optionally clear form and redirect after a delay
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setApiError(
        err.response?.data?.message ||
          "Failed to reset password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch text-white">
      {/* Left Panel */}
      <div className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 bg-black">
        <div
          className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center"
          style={{ backgroundImage: `url(${formBgImage})` }}
        >
          <div className="absolute bg-black opacity-60 inset-0 z-0"></div>
        </div>
        <div className="w-full py-6 z-20">
          <h1 className="text-4xl font-bold text-custom-orange mb-2">
            Reset Your Password
          </h1>
          <p className="text-base text-gray-300 mb-8">
            Enter your new password below.
          </p>

          <form
            onSubmit={handleSubmit}
            className="sm:w-2/3 w-full px-4 lg:px-0 mx-auto"
          >
            {apiError && (
              <p className="text-red-500 text-sm mb-4 text-center">
                {apiError}
              </p>
            )}
            {successMessage && (
              <p className="text-green-500 text-sm mb-4 text-center">
                {successMessage}
              </p>
            )}

            {/* New Password Field */}
            <div className="pb-2 pt-4">
              <label htmlFor="newPassword" /* ... */>
                New Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  // ... className with error styling ...
                />
                {/* ... error icon ... */}
              </div>
              {/* ... password error message ... */}
            </div>

            {/* Confirm New Password Field */}
            <div className="pb-2 pt-4">
              <label htmlFor="confirmPassword" /* ... */>
                Confirm New Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  // ... className with error styling ...
                />
                {/* ... error icon ... */}
              </div>
              {confirmPasswordError && (
                <p className="text-red-500 text-sm mt-1">
                  {confirmPasswordError}
                </p>
              )}
            </div>

            <div className="px-4 pb-2 pt-6">
              <button
                type="submit"
                disabled={isLoading || !!successMessage}
                className="uppercase block w-full p-3 text-lg rounded-md bg-custom-orange hover:bg-orange-600 disabled:opacity-50"
              >
                {isLoading ? "Resetting..." : "Set New Password"}
              </button>
            </div>
            {/* ... Link to Login ... */}
          </form>
        </div>
      </div>
      {/* Right Panel */}
      <div
        className="lg:flex w-1/2 hidden ..."
        style={{ backgroundImage: `url(${formBgImage})` }}
      >
        {/* ... */}
      </div>
    </div>
  );
}
export default ResetPasswordPage;
