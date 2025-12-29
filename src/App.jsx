import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { AuthProvider, useAuth } from "./AuthContext";

// Import Startup Pages (Public Routes)
import LoginPage from "./components/StartupPages/LoginPage";
import SignupPage from "./components/StartupPages/SignupPage";
import ForgotPasswordPage from "./components/StartupPages/ForgotPasswordPage";
import OtpVerificationPage from "./components/OtpverificationPage"; // Check path, previously outside StartupPages
import ResetPasswordPage from "./components/StartupPages/ResetPasswordPage";

// Import Main App Layout Component
import Container from "./components/Container/Container"; // This is your main app shell

// ProtectedRoute and PublicRoute components (remain largely the same)
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>;
  return user ? <Navigate to="/" replace /> : children;
};

// Main App component that includes the sidebar/header and the main content routes
// This component will contain the structure (Sidebar, Header) and render ContentArea
// We do NOT use <Outlet /> here, as ContentArea will handle its own <Routes>
const AuthenticatedAppLayout = () => {
  return (
    <Container /> // Container now renders Header, Sidebar, and ContentArea internally
  );
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes for Authentication Flows */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
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

            {/* Protected Routes for the Main Application */}
            {/* This route will match any path that starts with '/', ensuring only logged-in users access the main app */}
            {/* The ContentArea within Container will then define its own internal Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AuthenticatedAppLayout />
                </ProtectedRoute>
              }
            />

            {/* Fallback for any unmatched route (optional, can be a 404 page) */}
            {/* If the above '/*' doesn't catch it because of deeper nesting, this could be reached if unauthenticated */}
            {/* For a full app, you might have a dedicated 404 page here */}
            {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
          </Routes>
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;
