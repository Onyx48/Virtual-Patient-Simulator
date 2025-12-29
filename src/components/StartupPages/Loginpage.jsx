// src/components/StartupPages/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import loginImage from './login-bg.jpg'; // Ensure path is correct from StartupPages dir
import { useAuth } from '../../AuthContext'; // Assuming AuthContext is in src/context

// ... (validateEmail, validatePassword, errorIcon remain the same) ...
const validateEmail = (emailToValidate) => {
  if (!emailToValidate.trim()) return 'Email is required.';
  if (!/\S+@\S+\.\S+/.test(emailToValidate)) return 'Please use a valid email address.';
  return '';
};

const validatePassword = (passwordToValidate) => {
  if (!passwordToValidate) return 'Password is required.';
  return '';
};

const errorIcon = (
    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </div>
  );


function LoginPage() {
  const { login } = useAuth(); // Get login function from context
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // Keep if you plan to implement this

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState(''); // For general API errors from login
  const [isLoading, setIsLoading] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentEmailError = validateEmail(email);
    const currentPasswordError = validatePassword(password);

    setEmailError(currentEmailError);
    setPasswordError(currentPasswordError);
    setApiError(''); // Clear previous API errors

    if (!currentEmailError && !currentPasswordError) {
      setIsLoading(true);
      try {
        await login(email, password); // Call the login function from AuthContext
        // AuthContext's useEffect will set the user, and PublicRoute will redirect.
        // Or, you can navigate explicitly after login is confirmed by AuthContext.
        // navigate('/'); // Navigation will be handled by PublicRoute/ProtectedRoute
      } catch (err) {
        // AuthContext.login should throw an error that we can catch here
        const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
        setApiError(errorMessage);
        // You could try to be more specific if the backend returns distinct error types
        // For example, if it's specifically an email or password issue.
        // For now, a general API error is fine.
        // setEmailError(errorMessage); // Could set this if the error is clearly email-related
        // setPasswordError(" ");      // Or this if password-related
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(validateEmail(e.target.value));
    if (apiError) setApiError(''); // Clear API error on input change
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError(validatePassword(e.target.value));
    if (apiError) setApiError(''); // Clear API error on input change
  };

  return (
    <div className="min-h-screen flex items-stretch text-white">
      {/* Left Panel */}
      <div className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 bg-black">
        <div className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center"
          style={{ backgroundImage: `url(${loginImage})` }}>
          <div className="absolute bg-black opacity-60 inset-0 z-0"></div>
        </div>

        <div className="w-full py-6 z-20">
          <h1 className="text-4xl font-bold text-custom-orange mb-2">Welcome Back</h1>
          <p className="text-base text-gray-300 mb-8">
            Welcome back! Please enter your details.
          </p>

          <form onSubmit={handleSubmit} className="sm:w-2/3 w-full px-4 lg:px-0 mx-auto">
            {apiError && <p className="text-red-500 text-sm mb-4 text-center">{apiError}</p>}
            {/* Email Input */}
            <div className="pb-2 pt-4">
              <label htmlFor="email-login" className="block text-sm font-medium text-gray-300 text-left mb-1">Email</label>
              <div className="relative">
                <input
                  type="email" name="email" id="email-login" placeholder="Email" value={email}
                  onChange={handleEmailChange}
                  onBlur={() => setEmailError(validateEmail(email))}
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                    emailError ? 'border-red-500 ring-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-custom-orange'
                  }`}
                />
                {emailError && errorIcon}
              </div>
              {emailError && <p className="mt-2 text-sm text-red-500 text-left">{emailError}</p>}
            </div>

            {/* Password Input */}
            <div className="pb-2 pt-4">
              <label htmlFor="password-login" className="block text-sm font-medium text-gray-300 text-left mb-1">Password</label>
              <div className="relative">
                <input
                  type="password" name="password" id="password-login" placeholder="Password" value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  className={`block w-full p-3 text-lg rounded-md bg-gray-800 border placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                    passwordError ? 'border-red-500 ring-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-custom-orange'
                  }`}
                />
                {passwordError && errorIcon}
              </div>
              {passwordError && passwordError.trim() && <p className="mt-2 text-sm text-red-500 text-left">{passwordError}</p>}
            </div>

            <div className="flex justify-between items-center mt-2 mb-6">
                <div className="flex items-center">
                    <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-custom-orange bg-gray-800 border-gray-600 rounded focus:ring-custom-orange"/>
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">Remember Me</label>
                </div>
                <Link to="/forgot-password" className="text-sm text-gray-400 hover:underline hover:text-gray-100">Forgot Password?</Link>
            </div>
            
            <div className="px-4 pb-2 pt-4">
              <button type="submit" disabled={isLoading}
                className="uppercase block w-full p-3 text-lg rounded-md bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-custom-orange focus:ring-opacity-50 text-black font-semibold disabled:opacity-50"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
            <div className="mt-8 text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-custom-orange hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
      {/* Right Panel */}
      <div className="lg:flex w-1/2 hidden bg-gray-500 bg-no-repeat bg-cover relative items-center"
        style={{ backgroundImage: `url(${loginImage})` }}>
        <div className="absolute bg-black opacity-20 inset-0 z-0"></div>
      </div>
    </div>
  );
}
export default LoginPage;