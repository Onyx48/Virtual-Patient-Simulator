import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import formBgImage from "./login-bg.jpg"; // Reusing the same image
import axios from "axios";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(""); // For validation error
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (emailToValidate) => {
    if (!emailToValidate) {
      return "Email Address is required.";
    } else if (!/\S+@\S+\.\S+/.test(emailToValidate)) {
      return "Please enter a valid email address.";
    }
    return ""; // No error
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    setEmailError(validationError);
    setSuccessMessage("");

    if (!validationError) {
      setIsLoading(true);
      try {
        const response = await axios.post("/api/auth/forgot-password", {
          email,
        });
        setSuccessMessage(
          response.data.message || "If an account exists, an OTP will be sent."
        );
        // Optionally navigate to OTP page or show message to check email
        // navigate('/verify-otp', { state: { email } }); // If you want to auto-navigate
      } catch (error) {
        const apiError = error.response?.data;
        if (apiError?.lockoutUntil) {
          const lockoutTimestamp = apiError.lockoutUntil;
          const now = new Date().getTime();
          const remaining = Math.ceil((lockoutTimestamp - now) / 1000);
          setEmailError(
            `Account locked. Try again in ${Math.ceil(remaining / 60)} min(s).`
          );
        } else {
          setEmailError(
            apiError?.message || "Failed to send OTP. Please try again."
          );
        }
      } finally {
        setIsLoading(false);
      }
    }
  };
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) {
      // Clear error when user starts typing
      setEmailError(validateEmail(e.target.value));
    }
  };

  return (
    <div className="min-h-screen flex items-stretch text-white">
      {/* Left Panel (Form) */}
      <div className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 bg-black">
        <div
          className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center"
          style={{ backgroundImage: `url(${formBgImage})` }}
        >
          <div className="absolute bg-black opacity-60 inset-0 z-0"></div>
        </div>

        <div className="w-full py-6 z-20">
          <h1 className="text-4xl font-bold text-custom-orange mb-2">
            Forgot Password
          </h1>
          <p className="text-base text-gray-300 mb-8">
            Provide your account's email for which you <br /> want to reset your
            password
          </p>

          <form
            onSubmit={handleSubmit}
            className="sm:w-2/3 w-full px-4 lg:px-0 mx-auto"
          >
            <div className="pb-2 pt-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 text-left mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => setEmailError(validateEmail(email))} // Validate on blur
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-custom-orange focus:border-transparent ${
                    emailError
                      ? "border-red-500 ring-red-500"
                      : "border-gray-700"
                  }`}
                  // aria-invalid={emailError ? "true" : "false"} // For accessibility
                  // aria-describedby={emailError ? "email-error" : undefined}
                />
                {emailError && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-red-500"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {emailError && (
                <p
                  className="mt-2 text-sm text-red-500 text-left"
                  id="email-error"
                >
                  {emailError}
                </p>
              )}
              {successMessage && !emailError && (
                <p className="mt-2 text-sm text-green-500 text-left">
                  {successMessage}
                </p>
              )}
            </div>

            <div className="px-4 pb-2 pt-6">
              <button
                type="submit"
                className="uppercase block w-full p-3 text-lg rounded-md bg-custom-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-custom-orange focus:ring-opacity-50 text-black font-semibold disabled:opacity-50"
                disabled={isLoading}
              >
                Reset Password
              </button>
            </div>
            <div className="px-4 pb-2 pt-2">
              <Link
                to="/login" // Assuming your login route is /login
                className="uppercase block w-full p-3 text-lg rounded-md border border-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-50 text-gray-300 font-semibold"
              >
                Cancel
              </Link>
            </div>
            <div className="mt-8 text-center text-sm text-gray-400">
              <Link
                to="/login"
                className="font-semibold text-gray-300 hover:text-custom-orange hover:underline inline-flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to log in
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel (Image) */}
      <div
        className="lg:flex w-1/2 hidden bg-gray-500 bg-no-repeat bg-cover relative items-center"
        style={{ backgroundImage: `url(${formBgImage})` }}
      >
        <div className="absolute bg-black opacity-20 inset-0 z-0"></div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
