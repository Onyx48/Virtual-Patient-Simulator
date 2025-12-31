import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

// Create the context
const AuthContext = createContext(null);

// Configure Axios Base URL - DO THIS ONCE, typically in main.jsx or an api.js setup file
// For this example, I'll assume it's done elsewhere, or you can uncomment and set it here if needed.
// axios.defaults.baseURL = 'http://localhost:5001'; // Your backend URL (e.g., if backend is on 5001)

// Axios response interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid, logout user
      console.log('Token expired or invalid, logging out...');
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/login'; // Redirect to login
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores user object { _id, name, email, role, phoneNumber, profilePicture } or null
  const [loading, setLoading] = useState(true); // Initial loading state to check for existing session

  // --- Function to set user and persist to localStorage ---
  const processUserSession = useCallback((userData) => {
    if (userData && userData._id) { // Basic check for valid user data
      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      // If using JWTs
       if (userData.token) {
         localStorage.setItem('token', userData.token);
         axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
       }
    } else {
      // Clear session if userData is invalid or null
      setUser(null);
      localStorage.removeItem('currentUser');
       if (localStorage.getItem('token')) { // If using JWTs
         localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      }
    }
  }, []);


  // --- Check for existing session on app load ---
  useEffect(() => {
    const storedUserString = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('token'); // If using JWTs

    if (storedUserString && storedToken) {
      try {
        const storedUser = JSON.parse(storedUserString);
        // Restore axios header for JWT
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        // Here, you might want to verify the session with the backend if it's sensitive,
        // especially if not using JWTs or if JWTs could be stale.
        // For now, we trust localStorage for simplicity.
        processUserSession(storedUser);
      } catch (error) {
        console.error("Failed to parse stored user, clearing session:", error);
        processUserSession(null); // Clear invalid session
      }
    }
    setLoading(false); // Finished initial loading
  }, [processUserSession]);


  // --- Login Function ---
  const login = async (email, password) => {
    setLoading(true); // Indicate an auth operation is in progress
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      processUserSession(response.data); // response.data should be user object
      setLoading(false);
      return { success: true, user: response.data };
    } catch (error) {
      console.error("Login failed in AuthContext:", error.response?.data || error.message);
      processUserSession(null); // Clear any partial session on error
      setLoading(false);
      throw error; // Re-throw for the component to handle UI error display
    }
  };

  // --- Signup Function (for public student registration) ---
  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/register', {
        name,
        email,
        password,
        roleToCreate: 'student' // Default public registration to 'student'
        // No 'creatorRole' is sent for public student signup
      });
      // After signup, you might choose to automatically log them in or require them to log in.
      // For now, we don't automatically log them in via AuthContext.
      // The component can navigate to login or show a success message.
      setLoading(false);
      return { success: true, data: response.data }; // response.data includes created user info
    } catch (error) {
      console.error("Signup failed in AuthContext:", error.response?.data || error.message);
      setLoading(false);
      throw error;
    }
  };

  // --- Admin/Teacher Create User Function (Example) ---
  // This would be called from an admin/teacher dashboard, not public signup
  const createUserByAuthorized = async (newUserDetails, creatorDetails) => {
    // newUserDetails: { name, email, password, roleToCreate }
    // creatorDetails: { creatorRole (e.g., 'superadmin' or 'teacher') }
    // This function assumes the *calling user* (admin/teacher) is already authenticated
    // and their JWT (if used) is already in axios headers.
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/register', {
        ...newUserDetails,
        ...creatorDetails, // This sends the creatorRole to the backend
      });
      setLoading(false);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Create user by authorized failed:", error.response?.data || error.message);
      setLoading(false);
      throw error;
    }
  };

  // --- Update Profile Function ---
  const updateProfile = (updates) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  // --- Logout Function ---
  const logout = () => {
    console.log("Logging out user...");
    processUserSession(null); // Clear user state and localStorage
    // Navigation to /login will typically be handled by ProtectedRoute or in the component calling logout
  };

  const value = {
    user,
    loading, // Global loading state for auth operations
    isAuthenticated: !!user, // Derived state: true if user object exists
    login,
    signup, // Public student signup
    createUserByAuthorized, // For admin/teacher to create users
    updateProfile,
    logout,
    // You can add more functions here later, e.g., fetchUserProfile, updateUser, etc.
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};