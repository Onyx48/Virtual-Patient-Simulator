// src/components/OtpVerificationPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import { Link, useLocation, useNavigate } from 'react-router-dom';
import formBgImage from './StartupPages/Login-bg.jpg';
import axios from 'axios';

function OtpVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailForOtp = location.state?.email || '';

  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0); // Timer in seconds
  const [lockoutMessage, setLockoutMessage] = useState('');

  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCooldownTimer, setResendCooldownTimer] = useState(0); // For resend button cooldown

  const inputRefs = useRef([]);

  // Effect to handle lockout timer countdown
  useEffect(() => {
    let timerId;
    if (isLockedOut && lockoutTimer > 0) {
      timerId = setTimeout(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
    } else if (isLockedOut && lockoutTimer <= 0) {
      setIsLockedOut(false); // Unlock
      setLockoutMessage('');
      setAttemptsLeft(5); // Reset attempts conceptually for next OTP request
    }
    return () => clearTimeout(timerId);
  }, [isLockedOut, lockoutTimer]);

  // Effect to handle resend OTP button cooldown
  useEffect(() => {
      let timer;
      if (resendCooldownTimer > 0) {
          timer = setTimeout(() => setResendCooldownTimer(resendCooldownTimer - 1), 1000);
      } else {
          setResendDisabled(false);
      }
      return () => clearTimeout(timer);
  }, [resendCooldownTimer]);

  // Redirect if email is not available (e.g., direct navigation)
  useEffect(() => {
    if (!emailForOtp) {
      navigate('/forgot-password', { state: { message: "Session expired or invalid access. Please request OTP again." } });
    }
  }, [emailForOtp, navigate]);


  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;
    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);
    setError('');
    if (element.value !== "" && element.nextSibling && index < otp.length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && otp[index] === "" && e.target.previousSibling && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const processLockout = useCallback((lockoutTimestamp) => {
    const now = new Date().getTime();
    const remaining = Math.ceil((lockoutTimestamp - now) / 1000);
    if (remaining > 0) {
        setIsLockedOut(true);
        setLockoutTimer(remaining);
        setLockoutMessage(`Account locked. Try again in ${Math.ceil(remaining / 60)} min(s).`);
    } else {
        setIsLockedOut(false);
        setLockoutTimer(0);
        setLockoutMessage('');
    }
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut) return; // Don't submit if locked out

    setError('');
    setSuccessMessage('');
    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      setError("Please enter a 6-digit OTP.");
      return;
    }

    try {
      const response = await axios.post('/api/auth/verify-otp', {
        email: emailForOtp,
        otp: enteredOtp,
      });
      setSuccessMessage(response.data.message || "OTP Verified successfully!");

      if (response.data.canResetPassword && response.data.resetToken) { // Assuming backend sends a resetToken
        navigate(`/reset-password/${response.data.resetToken}`, { state: { email: emailForOtp } });
      } else if (response.data.canResetPassword) {
        // If no token but can reset, maybe navigate to a generic reset page or prompt login
        alert("OTP Verified! Please proceed to reset your password."); // Placeholder
        navigate('/login'); // Or a dedicated reset password form page
      } else {
        // Handle cases where OTP is verified but not for password reset (e.g., 2FA login)
        // For now, this example assumes OTP is for password reset context
        navigate('/login');
      }

    } catch (err) {
      const apiError = err.response?.data;
      setError(apiError?.message || "OTP verification failed.");
      if (apiError) {
        if (typeof apiError.attemptsLeft !== 'undefined') {
          setAttemptsLeft(apiError.attemptsLeft);
        }
        if (apiError.lockoutUntil) {
          processLockout(apiError.lockoutUntil);
        } else if (apiError.attemptsLeft <=0 && !apiError.lockoutUntil) {
            // This case handles if backend triggers lockout on this attempt without returning lockoutUntil
            // (though the backend logic now should always return lockoutUntil if it locks)
            setIsLockedOut(true);
            setLockoutTimer(20 * 60); // Default lockout if backend didn't specify
            setLockoutMessage(`Max attempts reached. Account locked for 20 minutes.`);
        }
      }
    }
  };

  const handleResendOtp = async () => {
    if (isLockedOut) {
        setError(lockoutMessage || "Account is locked. Cannot resend OTP now.");
        return;
    }
    if (resendDisabled) return;

    setError('');
    setSuccessMessage('');
    setResendDisabled(true);
    setResendCooldownTimer(60); // 60 seconds cooldown

    try {
        const response = await axios.post('/api/auth/forgot-password', { email: emailForOtp });
        setSuccessMessage(response.data.message || `A new OTP has been sent to ${emailForOtp}.`);
        setOtp(new Array(6).fill("")); // Clear OTP fields
        setAttemptsLeft(5); // Reset attempts counter on frontend for the new OTP
        setIsLockedOut(false); // Clear any previous soft lockout display
        setLockoutTimer(0);
        setLockoutMessage('');
    } catch (err) {
        const apiError = err.response?.data;
        setError(apiError?.message || "Failed to resend OTP. Please try again.");
        if (apiError?.lockoutUntil) {
            processLockout(apiError.lockoutUntil);
        }
        setResendDisabled(false); // Allow trying again sooner if API error
        setResendCooldownTimer(0); // Reset cooldown on error
    }
  };

  // Format lockoutTimer for display
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-stretch text-white">
      {/* Left Panel */}
      <div className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 bg-black">
        {/* ... mobile background ... */}
        <div className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center"
          style={{ backgroundImage: `url(${formBgImage})` }}>
          <div className="absolute bg-black opacity-60 inset-0 z-0"></div>
        </div>

        <div className="w-full py-6 z-20">
          {/* ... Icon and Titles ... */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gray-800 rounded-full border-2 border-custom-orange">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-custom-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-custom-orange mb-2">Check your email</h1>
          <p className="text-base text-gray-300 mb-6 px-2">
            We've sent an OTP to {emailForOtp || "your email"}. Please enter it below.
          </p>

          <form onSubmit={handleSubmit} className="sm:w-2/3 w-full px-4 lg:px-0 mx-auto">
            <div className="flex justify-center space-x-2 sm:space-x-3 mb-4">
              {otp.map((data, index) => (
                <input
                  key={index} type="text" name="otp" maxLength="1"
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-semibold bg-gray-800 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-custom-orange ${ (error || isLockedOut) ? 'border-red-500 ring-red-500' : 'border-gray-700' }`}
                  value={data}
                  onChange={e => handleChange(e.target, index)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => handleKeyDown(e, index)}
                  ref={el => inputRefs.current[index] = el}
                  disabled={isLockedOut}
                />
              ))}
            </div>

            {isLockedOut && lockoutMessage && (
              <p className="text-lg text-red-500 mb-4 font-semibold">
                {lockoutMessage} {lockoutTimer > 0 && ` (${formatTime(lockoutTimer)})`}
              </p>
            )}
            {error && !isLockedOut && (
              <p className="text-sm text-red-500 mb-4">
                {error}
                {attemptsLeft > 0 && attemptsLeft < 5 && ` Attempts left: ${attemptsLeft}.`}
              </p>
            )}
            {successMessage && <p className="text-sm text-green-500 mb-4">{successMessage}</p>}

            <div className="px-4 pb-2 pt-4">
              <button
                type="submit"
                className="uppercase block w-full p-3 text-lg rounded-md bg-custom-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-custom-orange focus:ring-opacity-50 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLockedOut || attemptsLeft <= 0}
              >
                Verify Email
              </button>
            </div>
            <div className="mt-4 text-center text-sm text-gray-400">
              Didn't receive the email?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendDisabled || isLockedOut || resendCooldownTimer > 0}
                className={`font-semibold text-custom-orange hover:underline focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Click to resend {resendCooldownTimer > 0 && `(${resendCooldownTimer}s)`}
              </button>
            </div>
            {/* ... Back to Sign Up link ... */}
             <div className="mt-8 text-center text-sm text-gray-400">
                <Link to={isLockedOut ? "/forgot-password" : "/signup"} className="font-semibold text-gray-300 hover:text-custom-orange hover:underline inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {isLockedOut ? "Request New OTP" : "Back to Sign Up"}
                </Link>
            </div>
          </form>
        </div>
      </div>
      {/* Right Panel */}
      <div className="lg:flex w-1/2 hidden bg-gray-500 bg-no-repeat bg-cover relative items-center"
        style={{ backgroundImage: `url(${formBgImage})` }}>
        <div className="absolute bg-black opacity-20 inset-0 z-0"></div>
      </div>
    </div>
  );
}

export default OtpVerificationPage;