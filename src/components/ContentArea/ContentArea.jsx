import React, { lazy, Suspense, useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "../../lib/router";
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
const SchoolDetailPage = lazy(() => import("../../roles/superadmin/schools/SchoolDetail"));

const ScenariosPage = lazy(() => import("../../roles/educator/scenarios/index.jsx"));
const ScenarioAnalytics = lazy(() => import("../../roles/educator/scenarios/ScenarioAnalytics.jsx"));
const StudentScenariosPage = lazy(() => import("../StudentScenariosPage.jsx"));
const StudentScenarioDetails = lazy(() => import("../../roles/student/scenarios/StudentScenarioDetails.jsx"));
const ScenarioFormPage = lazy(() => import("../shared/NewScenarioPage"));

const EducatorStudentsPage = lazy(() => import("../../roles/educator/students/Student.jsx"));
const SchoolAdminStudentsPage = lazy(() => import("../../roles/school_admin/students/Student.jsx"));
const StudentsPage = lazy(() => import("../StudentsPage.jsx"));

const SchoolAdminEducatorsPage = lazy(() => import("../../roles/school_admin/educators/Educator.jsx"));

const AccountSettingsPage = lazy(() => import("../settings/SettingsPage"));
const DefinitionsPage = lazy(() => import("../shared/DefinitionsPage"));
const GroupPage = lazy(() => import("../../roles/educator/groups/GroupPage"));
const ReadinessPage = lazy(() => import("../../roles/educator/readiness/ReadinessPage"));
const RubricBankPage = lazy(() => import("../../roles/educator/rubrics/RubricBank"));

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-full bg-gray-50" />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

/*
 * Keeps each page's scroll position for the tab's lifetime, so going back from an edit page
 * lands where the educator left the list. Restores once the page has had a moment to render.
 */
// Only Back/Forward restores a position; a fresh visit (signing in, a link, the sidebar) starts at the top.
let cameBack = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { cameBack = true; });

function useScrollMemory(ref) {
  const { pathname, search } = useLocation();
  const key = `vps.scroll:${pathname}${search}`;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let saved = 0;
    if (cameBack) { try { saved = Number(sessionStorage.getItem(key)) || 0; } catch { /* storage blocked */ } }
    cameBack = false;
    el.scrollTop = 0;
    const timers = saved ? [80, 300, 800].map((ms) => setTimeout(() => { if (el.scrollTop < saved) el.scrollTop = saved; }, ms)) : [];
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { try { sessionStorage.setItem(key, String(el.scrollTop)); } catch { /* storage blocked */ } });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); el.removeEventListener("scroll", onScroll); };
  }, [key, ref]);
}

const guard = (roles, el) => <RoleBasedRoute allowedRoles={roles}>{el}</RoleBasedRoute>;
const ALL = ["superadmin", "school_admin", "educator", "student"];

/** Page components for the route tree in src/router.jsx; role rules unchanged from the old <Routes>. */
export const pages = {
  Dashboard: function DashboardPage() {
    const { user } = useAuth();
    switch (user?.role) {
      case "student": return <StudentDashboard />;
      case "educator": return <EducatorDashboard />;
      case "superadmin": return <SuperAdminDashboard />;
      case "school_admin": return <SchoolAdminDashboard />;
      default: return <div>Unknown role</div>;
    }
  },
  Schools: () => guard(["superadmin", "school_admin"], <SchoolsPage />),
  SchoolForm: () => guard(["superadmin"], <SchoolFormPage />),
  SchoolDetail: () => guard(["superadmin"], <SchoolDetailPage />),
  Scenarios: function ScenariosRoute() {
    const { user } = useAuth();
    return guard(["school_admin", "educator", "student"],
      user?.role === "student" ? <StudentScenariosPage /> : <ScenariosPage />);
  },
  StudentScenario: () => guard(["student"], <StudentScenarioDetails />),
  ScenarioAdd: () => guard(["educator"], <ScenarioFormPage />),
  ScenarioEdit: () => guard(["educator", "school_admin"], <ScenarioFormPage />),
  ScenarioView: () => guard(["educator", "school_admin", "superadmin"], <ScenarioAnalytics />),
  Students: function StudentsRoute() {
    const { user } = useAuth();
    return guard(["superadmin", "school_admin", "educator"],
      user?.role === "educator" ? <EducatorStudentsPage /> : user?.role === "school_admin" ? <SchoolAdminStudentsPage /> : <StudentsPage role={user?.role} />);
  },
  Educators: () => guard(["school_admin"], <SchoolAdminEducatorsPage />),
  Settings: () => guard(ALL, <AccountSettingsPage />),
  Definitions: () => guard(ALL, <DefinitionsPage />),
  Group: () => guard(["educator", "school_admin"], <GroupPage />),
  Readiness: () => guard(["educator", "school_admin"], <ReadinessPage />),
  Rubrics: () => guard(["educator", "school_admin"], <RubricBankPage />),
  NotFound: () => <Navigate to="/" replace />,
};

/** The scrolling page area inside the app panel; the matched route renders into the Outlet. */
function ContentArea() {
  const mainRef = useRef(null);
  useScrollMemory(mainRef);
  return (
    <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
      <Suspense fallback={<FullPageSpinner />}>
        <Outlet />
      </Suspense>
    </main>
  );
}

export default ContentArea;
