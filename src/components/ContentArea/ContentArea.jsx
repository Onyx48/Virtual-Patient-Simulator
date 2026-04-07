import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";

const StudentDashboard = lazy(() => import("../../roles/student/Dashboard"));
const EducatorDashboard = lazy(() => import("../../roles/educator/Dashboard"));
const SuperAdminDashboard = lazy(
  () => import("../../roles/superadmin/Dashboard"),
);
const SchoolAdminDashboard = lazy(
  () => import("../../roles/school_admin/Dashboard"),
);

import SchoolsPage from "../../roles/superadmin/schools/Schools";
import SchoolFormPage from "../../roles/superadmin/schools/SchoolFormPage";

import ScenariosPage from "../../roles/educator/scenarios/index.jsx";
import SchoolAdminScenariosPage from "../../roles/school_admin/scenarios/index.jsx";
import StudentScenariosPage from "../StudentScenariosPage.jsx";
import StudentScenarioDetails from "../../roles/student/scenarios/StudentScenarioDetails.jsx";
import ScenarioFormPage from "../shared/ScenarioFormPage";

import EducatorStudentsPage from "../../roles/educator/students/Student.jsx";
import SchoolAdminStudentsPage from "../../roles/school_admin/students/Student.jsx";
import StudentsPage from "../StudentsPage.jsx";

import SchoolAdminEducatorsPage from "../../roles/school_admin/educators/Educator.jsx";

import AccountSettingsPage from "../settings/SettingsPage";
import HelpCenterPage from "../HelpCenter/HelpCenterPage";
import ReportPage from "../Report/ReportPage";

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-full bg-gray-50" />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function ContentArea() {
  const { user } = useAuth();

  const getDashboardComponent = () => {
    switch (user?.role) {
      case "student":
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <StudentDashboard />
          </Suspense>
        );
      case "educator":
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <EducatorDashboard />
          </Suspense>
        );
      case "superadmin":
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <SuperAdminDashboard />
          </Suspense>
        );
      case "school_admin":
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <SchoolAdminDashboard />
          </Suspense>
        );
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <main className="absolute top-16 left-64 right-0 bottom-0 overflow-y-auto bg-gray-50 p-4">
      <Routes>
        <Route path="/" element={getDashboardComponent()} />

        {/* Schools Routes */}
        <Route
          path="/schools"
          element={
            <RoleBasedRoute allowedRoles={["superadmin", "school_admin"]}>
              <SchoolsPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/schools/add"
          element={
            <RoleBasedRoute allowedRoles={["superadmin"]}>
              <SchoolFormPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/schools/edit/:id"
          element={
            <RoleBasedRoute allowedRoles={["superadmin"]}>
              <SchoolFormPage />
            </RoleBasedRoute>
          }
        />

        <Route
          path="/scenarios"
          element={
            <RoleBasedRoute
              allowedRoles={["school_admin", "educator", "student"]}
            >
              {user?.role === "student" ? (
                <StudentScenariosPage />
              ) : user?.role === "school_admin" ? (
                <SchoolAdminScenariosPage />
              ) : (
                <ScenariosPage />
              )}
            </RoleBasedRoute>
          }
        />
        <Route
          path="/student/scenario/:id"
          element={
            <RoleBasedRoute allowedRoles={["student"]}>
              <div className="p-8 bg-[#F9FAFB] min-h-screen">
                <StudentScenarioDetails onBack={() => window.history.back()} />
              </div>
            </RoleBasedRoute>
          }
        />
        <Route
          path="/scenarios/add"
          element={
            <RoleBasedRoute allowedRoles={["educator"]}>
              <ScenarioFormPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/scenarios/edit/:id"
          element={
            <RoleBasedRoute allowedRoles={["educator"]}>
              <ScenarioFormPage />
            </RoleBasedRoute>
          }
        />

        <Route
          path="/students/*"
          element={
            <RoleBasedRoute
              allowedRoles={["superadmin", "school_admin", "educator"]}
            >
              {user?.role === "educator" ? (
                <EducatorStudentsPage />
              ) : user?.role === "school_admin" ? (
                <SchoolAdminStudentsPage />
              ) : (
                <StudentsPage role={user?.role} />
              )}
            </RoleBasedRoute>
          }
        />

        <Route
          path="/educators"
          element={
            <RoleBasedRoute allowedRoles={["school_admin"]}>
              <SchoolAdminEducatorsPage />
            </RoleBasedRoute>
          }
        />

        <Route
          path="/settings/*"
          element={
            <RoleBasedRoute
              allowedRoles={[
                "superadmin",
                "school_admin",
                "educator",
                "student",
              ]}
            >
              <AccountSettingsPage />
            </RoleBasedRoute>
          }
        />

        <Route
          path="/help-center"
          element={
            <RoleBasedRoute
              allowedRoles={[
                "superadmin",
                "school_admin",
                "educator",
                "student",
              ]}
            >
              <HelpCenterPage />
            </RoleBasedRoute>
          }
        />

        <Route
          path="/report"
          element={
            <RoleBasedRoute
              allowedRoles={["superadmin", "school_admin", "educator"]}
            >
              <ReportPage />
            </RoleBasedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

export default ContentArea;
