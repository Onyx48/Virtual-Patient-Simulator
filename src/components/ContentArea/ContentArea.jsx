import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { FullPageSpinner } from "../../lib/hooks/useLoading";

const StudentDashboard = lazy(() => import("../../roles/student/Dashboard"));
const EducatorDashboard = lazy(() => import("../../roles/educator/Dashboard"));
const SuperAdminDashboard = lazy(
  () => import("../../roles/superadmin/Dashboard"),
);
const SchoolAdminDashboard = lazy(
  () => import("../../roles/school_admin/Dashboard"),
);

const SchoolsPage = lazy(() => import("../../roles/superadmin/schools/Schools"));
const SchoolFormPage = lazy(() => import("../../roles/superadmin/schools/SchoolFormPage"));

const ScenariosPage = lazy(() => import("../../roles/educator/scenarios/index.jsx"));
const SchoolAdminScenariosPage = lazy(() => import("../../roles/school_admin/scenarios/index.jsx"));
const StudentScenariosPage = lazy(() => import("../StudentScenariosPage.jsx"));
const StudentScenarioDetails = lazy(() => import("../../roles/student/scenarios/StudentScenarioDetails.jsx"));
const ScenarioFormPage = lazy(() => import("../shared/ScenarioFormPage"));

const EducatorStudentsPage = lazy(() => import("../../roles/educator/students/Student.jsx"));
const SchoolAdminStudentsPage = lazy(() => import("../../roles/school_admin/students/Student.jsx"));
const StudentsPage = lazy(() => import("../StudentsPage.jsx"));

const SchoolAdminEducatorsPage = lazy(() => import("../../roles/school_admin/educators/Educator.jsx"));

const AccountSettingsPage = lazy(() => import("../settings/SettingsPage"));
const HelpCenterPage = lazy(() => import("../HelpCenter/HelpCenterPage"));
const ReportPage = lazy(() => import("../Report/ReportPage"));

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
          <Suspense fallback={<FullPageSpinner />}>
            <StudentDashboard />
          </Suspense>
        );
      case "educator":
        return (
          <Suspense fallback={<FullPageSpinner />}>
            <EducatorDashboard />
          </Suspense>
        );
      case "superadmin":
        return (
          <Suspense fallback={<FullPageSpinner />}>
            <SuperAdminDashboard />
          </Suspense>
        );
      case "school_admin":
        return (
          <Suspense fallback={<FullPageSpinner />}>
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
