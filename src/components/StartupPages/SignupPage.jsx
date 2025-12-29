// src/components/StartupPages/SignupPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import signupImage from "./login-bg.jpg"; // Ensure path is correct
import { useAuth } from "../../AuthContext"; // Import useAuth

// ... (validateName, validateEmail, validatePasswordSignup, errorIcon remain the same) ...
const validateName = (name) => {
  /* ... */
};
const validateEmail = (email) => {
  /* ... */
};
const validatePasswordSignup = (password) => {
  /* ... */
};
// const errorIcon = ( /* ... */ );

function SignupPage() {
  const { signup } = useAuth(); // Get signup function from context
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Assuming public signup is for 'student' role by default as per AuthContext.signup
  // If you need a role dropdown for admins creating users, this would be more complex
  // and the signup function in AuthContext would need modification or a separate admin-create-user function.

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentNameError = validateName(name);
    const currentEmailError = validateEmail(email);
    const currentPasswordError = validatePasswordSignup(password);

    setNameError(currentNameError);
    setEmailError(currentEmailError);
    setPasswordError(currentPasswordError);
    setApiError("");

    if (!currentNameError && !currentEmailError && !currentPasswordError) {
      setIsLoading(true);
      try {
        // AuthContext.signup by default registers as 'student'
        await signup(name, email, password);
        // After successful signup, AuthContext might log them in automatically or not.
        // If it does log them in, PublicRoute will redirect.
        // If not, navigate to login or show a success message.
        alert("Signup Successful! Please log in."); // Or a more elegant notification
        navigate("/login");
      } catch (err) {
        setApiError(
          err.response?.data?.message ||
            err.message ||
            "Signup failed. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ... (handleNameChange, handleEmailChange, handlePasswordChange remain similar) ...
  const handleNameChange = (e) => {
    setName(e.target.value);
    if (nameError) setNameError(validateName(e.target.value));
    if (apiError) setApiError("");
  };
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(validateEmail(e.target.value));
    if (apiError) setApiError("");
  };
  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError(validatePasswordSignup(e.target.value));
    if (apiError) setApiError("");
  };

  return (
    <div className="min-h-screen flex items-stretch text-white">
      {/* Left Panel */}
      <div className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 bg-black">
        <div
          className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center"
          style={{ backgroundImage: `url(${signupImage})` }}
        >
          <div className="absolute bg-black opacity-60 inset-0 z-0"></div>
        </div>

        <div className="w-full py-6 z-20">
          <h1 className="text-4xl font-bold text-custom-orange mb-2">
            Sign Up
          </h1>
          <p className="text-base text-gray-300 mb-8">
            Sign up to SIT with few simple steps.
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
            {/* Name Input */}
            <div className="pb-2 pt-4">
              <label
                htmlFor="name-signup"
                className="block text-sm font-medium text-gray-300 text-left mb-1"
              >
                Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  id="name-signup"
                  placeholder="Full Name"
                  value={name}
                  onChange={handleNameChange}
                  onBlur={() => setNameError(validateName(name))}
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                    nameError
                      ? "border-red-500 ring-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-custom-orange"
                  }`}
                />
                {nameError && errorIcon}
              </div>
              {nameError && (
                <p className="mt-2 text-sm text-red-500 text-left">
                  {nameError}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="pb-2 pt-4">
              <label
                htmlFor="email-signup"
                className="block text-sm font-medium text-gray-300 text-left mb-1"
              >
                Email<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  id="email-signup"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => setEmailError(validateEmail(email))}
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                    emailError
                      ? "border-red-500 ring-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-custom-orange"
                  }`}
                />
                {emailError && errorIcon}
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-500 text-left">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="pb-2 pt-4">
              <label
                htmlFor="password-signup"
                className="block text-sm font-medium text-gray-300 text-left mb-1"
              >
                Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  id="password-signup"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() =>
                    setPasswordError(validatePasswordSignup(password))
                  }
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                    passwordError
                      ? "border-red-500 ring-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-custom-orange"
                  }`}
                  minLength={8}
                />
                {passwordError && errorIcon}
              </div>
              {passwordError ? (
                <p className="mt-2 text-sm text-red-500 text-left">
                  {passwordError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1 text-left">
                  Must be at least 8 characters.
                </p>
              )}
            </div>

            <div className="px-4 pb-2 pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="uppercase block w-full p-3 text-lg rounded-md bg-custom-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-custom-orange focus:ring-opacity-50 text-black font-semibold disabled:opacity-50"
              >
                {isLoading ? "Signing Up..." : "Get Started"}
              </button>
            </div>
            <div className="mt-8 text-center text-sm text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-custom-orange hover:underline"
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
      {/* Right Panel */}
      <div
        className="lg:flex w-1/2 hidden bg-gray-500 bg-no-repeat bg-cover relative items-center"
        style={{ backgroundImage: `url(${signupImage})` }}
      >
        <div className="absolute bg-black opacity-20 inset-0 z-0"></div>
      </div>
    </div>
  );
}
export default SignupPage;
