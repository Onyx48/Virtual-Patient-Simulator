// src/components/Container/ContentArea.jsx
import React, { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom"; // Don't forget Routes and Route

// Import your actual page components
const StudentDashboard = lazy(() => import('../../roles/student/Dashboard'));
const EducatorDashboard = lazy(() => import('../../roles/educator/Dashboard'));
const SuperAdminDashboard = lazy(() => import('../../roles/superadmin/Dashboard'));
const SchoolAdminDashboard = lazy(() => import('../../roles/school_admin/Dashboard'));
import SchoolsPage from '../../roles/superadmin/schools/Schools';       // Schools in superadmin
import ScenariosPage from '../../roles/educator/scenarios/index';     // Scenarios in educator
import ScenarioFormPage from '../../roles/educator/scenarios/ScenarioFormPage';     // Add/Edit scenario in educator
import StudentPage from '../../roles/educator/students/Student';       // Students in educator
import AccountSettingsPage from '../UserSettings/AccountSettings'; // Assuming this is src/components/Settings/AccountSettingsPage.jsx
import HelpCenterPage from '../HelpCenter/HelpCenterPage';
import ReportPage from '../Report/ReportPage';

// You'll also need a RoleBasedRoute if you want to reuse it here
import { useAuth } from '../../AuthContext'; // To import useAuth for RoleBasedRoute

// RoleBasedRoute component (re-defined here for clarity, centralize if possible)
const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading content...</div>; // Smaller loading message for inner routes

  if (!user) return <Navigate to="/login" replace />; // Should be caught by App.jsx's ProtectedRoute, but good fallback

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.warn(`User role "${user.role}" not authorized for this inner route. Allowed: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />; // Redirect unauthorized users to dashboard/home
  }
  return children;
};


function ContentArea() {
  const { user } = useAuth();

  const getDashboardComponent = () => {
    switch (user?.role) {
      case 'student':
        return <StudentDashboard />;
      case 'educator':
        return <EducatorDashboard />;
      case 'superadmin':
        return <SuperAdminDashboard />;
      case 'school_admin':
        return <SchoolAdminDashboard />;
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <main className="absolute top-16 left-64 right-0 bottom-0 overflow-y-auto bg-gray-50 p-4">
      <Routes>
        {/* Dashboard - Accessible by all authenticated roles */}
        <Route path="/" element={getDashboardComponent()} />

        {/* Schools - Example: Accessible by Superadmin, School Admin, and Educator */}
        <Route path="/schools/*" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator']}> {/* Note 'educator' role */}
            <SchoolsPage />
          </RoleBasedRoute>
        }/>

        {/* Scenarios - Accessible by Superadmin, School Admin, Educator, and Student (read-only for student) */}
        <Route path="/scenarios" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator', 'student']}>
            <ScenariosPage />
          </RoleBasedRoute>
        }/>
        <Route path="/scenarios/add" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator']}>
            <ScenarioFormPage />
          </RoleBasedRoute>
        }/>
        <Route path="/scenarios/edit/:id" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator']}>
            <ScenarioFormPage />
          </RoleBasedRoute>
        }/>

        {/* Students - Example: Accessible by Superadmin, School Admin, and Educator */}
        <Route path="/students/*" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator']}>
            <StudentPage />
          </RoleBasedRoute>
        }/>

        {/* Settings - Example: Only accessible by Superadmin */}
        <Route path="/settings/*" element={
          <RoleBasedRoute allowedRoles={['superadmin']}>
            <AccountSettingsPage />
          </RoleBasedRoute>
        }/>

        {/* Help & Center - Accessible by all roles */}
        <Route path="/help-center" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'educator', 'student', 'school_admin']}> {/* Allow all roles */}
            <HelpCenterPage />
          </RoleBasedRoute>
        }/>

        {/* Report - Example: Accessible by Superadmin, School Admin, and Educator */}
        <Route path="/report" element={
          <RoleBasedRoute allowedRoles={['superadmin', 'school_admin', 'educator']}>
            <ReportPage />
          </RoleBasedRoute>
        }/>

        {/* Fallback for any unknown route within the authenticated section */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

export default ContentArea;