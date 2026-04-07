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
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#fef3c7",
              color: "#f97316",
              border: "1px solid #f97316",
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
