import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { clearSessions } from "./redux/slices/sessionSlice.js";

const AuthContext = createContext(null);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.log("Token expired or invalid, logging out...");
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      delete axios.defaults.headers.common["Authorization"];
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const token = localStorage.getItem("token");
        if (token) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const processUserSession = useCallback((userData) => {
    if (userData && userData._id) {
      setUser(userData);
      localStorage.setItem("currentUser", JSON.stringify(userData));
      if (userData.token) {
        localStorage.setItem("token", userData.token);
        axios.defaults.headers.common["Authorization"] =
          `Bearer ${userData.token}`;
      }
    } else {
      setUser(null);
      localStorage.removeItem("currentUser");
      if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        delete axios.defaults.headers.common["Authorization"];
      }
    }
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/auth/login", { email, password });
      processUserSession(response.data);
      setLoading(false);
      return { success: true, user: response.data };
    } catch (error) {
      console.error(
        "Login failed in AuthContext:",
        error.response?.data || error.message,
      );
      processUserSession(null);
      setLoading(false);
      throw error;
    }
  };

  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/auth/register", {
        name,
        email,
        password,
        roleToCreate: "student",
      });
      setLoading(false);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(
        "Signup failed in AuthContext:",
        error.response?.data || error.message,
      );
      setLoading(false);
      throw error;
    }
  };

  const createUserByAuthorized = async (newUserDetails, creatorDetails) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/auth/register", {
        ...newUserDetails,
        ...creatorDetails,
      });
      setLoading(false);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(
        "Create user by authorized failed:",
        error.response?.data || error.message,
      );
      setLoading(false);
      throw error;
    }
  };

  const updateProfile = (updates) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    console.log("Logging out user...");
    dispatch(clearSessions());
    processUserSession(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    createUserByAuthorized,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
