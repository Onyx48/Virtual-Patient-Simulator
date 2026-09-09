import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import { AuthProvider, useAuth } from "./AuthContext";
import { Toaster } from "react-hot-toast";

import LoginPage from "./components/StartupPages/LoginPage";
import SignupPage from "./components/StartupPages/SignupPage";
import ForgotPasswordPage from "./components/StartupPages/ForgotPasswordPage";
import OtpVerificationPage from "./components/OtpverificationPage";
import ResetPasswordPage from "./components/StartupPages/ResetPasswordPage";

import Container from "./components/Container/Container";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (user) return <Navigate to="/" replace />;
  return children;
};

const AuthenticatedAppLayout = () => {
  return <Container />;
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        {/*
          One style for every toast used to mean an error arrived as orange text
          on an amber card — the same as a success — so the only thing carrying
          "this failed" was the wording. These are readable dark-on-white cards
          with the state in the icon and the left edge: red for a failure, green
          for a success, brand orange for anything neutral. Errors also linger,
          because they are the ones worth reading.
        */}
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 4000,
            style: {
              background: "#ffffff",
              color: "#1f2937",
              fontSize: "0.875rem",
              fontWeight: 500,
              maxWidth: "420px",
              padding: "12px 16px",
              borderRadius: "10px",
              borderLeft: "4px solid #f97316",
              boxShadow:
                "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
            },
            success: {
              iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
              style: { borderLeft: "4px solid #16a34a" },
            },
            error: {
              duration: 6000,
              iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
              style: { borderLeft: "4px solid #dc2626" },
            },
            loading: {
              iconTheme: { primary: "#f97316", secondary: "#ffffff" },
            },
          }}
        />
        <Router>
          <Routes>
            {/* Public Routes for Authentication Flows */}
            {/* <Route
              path="/signup"
              element={
                <PublicRoute>
                  <SignupPage />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicRoute>
                  <OtpVerificationPage />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password/:token?"
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              }
            /> */}
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <SignupPage />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicRoute>
                  <OtpVerificationPage />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password/:token?"
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              }
            />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AuthenticatedAppLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;
