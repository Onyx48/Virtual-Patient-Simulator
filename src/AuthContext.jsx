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
import { identifyUser } from "./lib/monitoring";
import { refreshSession, setAccessToken } from "./lib/authToken.js";

const AuthContext = createContext(null);

// Older builds kept the token here; it is memory-only now (lib/authToken.js).
localStorage.removeItem("token");

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/verify-otp", "/reset-password"];

/*
 * A 401 usually means the 15-minute access token ran out: get a new one from the
 * refresh cookie and replay the request once. Only when the refresh itself fails
 * (logged out, 90 days unused, password changed) does the user go to the login page.
 * A 401 from /login is a wrong password and is left to the LoginPage.
 */
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const url = config.url || "";
    const skip = config._skipAuthRefresh || config._retried || url.includes("/api/auth/login") || url.includes("/api/auth/logout");
    if (error.response?.status !== 401 || skip) return Promise.reject(error);

    const session = await refreshSession();
    if (session?.token) {
      config._retried = true;
      config.headers = { ...config.headers, Authorization: `Bearer ${session.token}` };
      return axios(config);
    }
    localStorage.removeItem("currentUser");
    if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.href = "/login";
    return Promise.reject(error);
  },
);

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  // true until the refresh cookie has been checked, so routes wait instead of
  // bouncing a logged-in user to /login on every page load
  const [loading, setLoading] = useState(true);

  // Tag Sentry errors and PostHog events with who is logged in.
  useEffect(() => {
    identifyUser(user);
  }, [user]);
  // currentUser in localStorage is only the profile (no token), for pages that read it.
  const processUserSession = useCallback((userData) => {
    if (userData && userData._id) {
      const { token, ...profile } = userData;
      if (token) setAccessToken(token);
      setUser(profile);
      localStorage.setItem("currentUser", JSON.stringify(profile));
    } else {
      setAccessToken("");
      setUser(null);
      localStorage.removeItem("currentUser");
    }
  }, []);

  // Page load: the access token is gone (memory only), so swap the refresh cookie for one.
  useEffect(() => {
    let alive = true;
    refreshSession().then((session) => {
      if (!alive) return;
      processUserSession(session);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [processUserSession]);

  /*
   * These never touch `loading`: it means "still checking the refresh cookie on page load", and
   * setting it here made the signed-out routes swap the login page for a blank screen mid-request,
   * so a wrong password looked like a page refresh and the error was never shown.
   */
  const login = async (email, password) => {
    try {
      const response = await axios.post("/api/auth/login", { email, password });
      processUserSession(response.data);
      return { success: true, user: response.data };
    } catch (error) {
      console.error(
        "Login failed in AuthContext:",
        error.response?.data || error.message,
      );
      processUserSession(null);
      throw error;
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await axios.post("/api/auth/register", {
        name,
        email,
        password,
        roleToCreate: "student",
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error(
        "Signup failed in AuthContext:",
        error.response?.data || error.message,
      );
      throw error;
    }
  };

  const createUserByAuthorized = async (newUserDetails, creatorDetails) => {
    try {
      const response = await axios.post("/api/auth/register", {
        ...newUserDetails,
        ...creatorDetails,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error(
        "Create user by authorized failed:",
        error.response?.data || error.message,
      );
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
    // Cancels the refresh token on the server and clears the cookie.
    // Wait for the server to clear the refresh cookie (or fail), then load the login page fresh.
    // Navigating ourselves avoids the signed-in layout redirecting mid-render, and the full load
    // drops everything the last user had in memory.
    const done = () => { processUserSession(null); window.location.replace("/login"); };
    axios.post("/api/auth/logout", {}, { _skipAuthRefresh: true }).then(done, done);
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
