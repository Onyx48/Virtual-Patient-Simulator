// The route tree, on TanStack Router (code-based). Pages use the hooks in src/lib/router.jsx.
//
//   root
//   ├─ public website: / (signed out), /how-it-works, /for-educators, /for-institutions, /about,
//   │  /trust, /contact, /terms, /privacy, /acceptable-use, /cookies
//   ├─ /login, /signup, /forgot-password, /verify-otp, /reset-password[/$token]   (signed-out only)
//   └─ _app  (signed-in layout: sidebar + header + panel)                          (signed-in only)
//      ├─ /                         dashboard for the user's role
//      ├─ /schools, /schools/add, /schools/edit/$id
//      ├─ /scenarios, /scenarios/add, /scenarios/edit/$id, /student/scenario/$id
//      ├─ /students (+ /students/$ for old deep links), /educators, /settings (+ /settings/$)
//      └─ anything else → /
import React from "react";
import { createRootRoute, createRoute, createRouter, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { Navigate } from "./lib/router";
import * as Site from "./site/pages";

import LoginPage from "./components/StartupPages/LoginPage";
import SignupPage from "./components/StartupPages/SignupPage";
import ForgotPasswordPage from "./components/StartupPages/ForgotPasswordPage";
import OtpVerificationPage from "./components/OtpverificationPage";
import ResetPasswordPage from "./components/StartupPages/ResetPasswordPage";
import Container from "./components/Container/Container";
import { pages } from "./components/ContentArea/ContentArea";

const Blank = () => <div className="min-h-screen bg-gray-50" />;

function SignedOutOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Blank />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/*
 * Signed out under the app layout: the website home at "/", the login page anywhere else.
 * Decided from the location on screen (resolvedLocation), not the one being navigated to: during a
 * navigation away from "/" (to /login, /how-it-works, ...) this still renders for a moment with the
 * new address, and redirecting then fought the navigation and froze the tab.
 */
function SignedOutHome() {
  const shown = useRouterState({ select: (s) => (s.resolvedLocation || s.location).pathname });
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  if (shown === "/" || pending) return <Site.SiteHome />;
  return <Navigate to="/login" replace />;
}

function SignedInLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Blank />;
  // Signed out at "/": the public website's home page instead of the login screen.
  if (!user) return <SignedOutHome />;
  return <Container />;
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const pub = (path, Page) => createRoute({ getParentRoute: () => rootRoute, path, component: () => <SignedOutOnly><Page /></SignedOutOnly> });

// Public website pages: open to everyone, signed in or not.
const site = (path, Page) => createRoute({ getParentRoute: () => rootRoute, path, component: Page });

const appRoute = createRoute({ getParentRoute: () => rootRoute, id: "_app", component: SignedInLayout });
const page = (path, component) => createRoute({ getParentRoute: () => appRoute, path, component });

const routeTree = rootRoute.addChildren([
  pub("/login", LoginPage),
  pub("/signup", SignupPage),
  pub("/forgot-password", ForgotPasswordPage),
  pub("/verify-otp", OtpVerificationPage),
  pub("/reset-password", ResetPasswordPage),
  pub("/reset-password/$token", ResetPasswordPage),
  site("/how-it-works", Site.SiteHowItWorks),
  site("/for-educators", Site.SiteEducators),
  site("/for-institutions", Site.SiteInstitutions),
  site("/about", Site.SiteAbout),
  site("/trust", Site.SiteTrust),
  site("/contact", Site.SiteContact),
  site("/terms", Site.SiteTerms),
  site("/privacy", Site.SitePrivacy),
  site("/acceptable-use", Site.SiteAcceptableUse),
  site("/cookies", Site.SiteCookies),
  appRoute.addChildren([
    page("/", pages.Dashboard),
    page("/schools", pages.Schools),
    page("/schools/add", pages.SchoolForm),
    page("/schools/edit/$id", pages.SchoolForm),
    page("/schools/$id", pages.SchoolDetail),
    page("/scenarios", pages.Scenarios),
    page("/scenarios/add", pages.ScenarioAdd),
    page("/scenarios/edit/$id", pages.ScenarioEdit),
    page("/scenarios/view/$id", pages.ScenarioView),
    page("/student/scenario/$id", pages.StudentScenario),
    page("/students", pages.Students),
    page("/students/$", pages.Students),
    page("/educators", pages.Educators),
    page("/groups/$id", pages.Group),
    page("/readiness", pages.Readiness),
    page("/rubrics", pages.Rubrics),
    page("/definitions", pages.Definitions),
    page("/settings", pages.Settings),
    page("/settings/$", pages.Settings),
  ]),
]);

/*
 * Search is read and written as plain query strings (?q=Ahmad&assign=1), not TanStack's default
 * JSON encoding, so links in emails and bookmarks stay readable and values stay strings.
 */
const parseSearch = (str) => Object.fromEntries(new URLSearchParams(str.startsWith("?") ? str.slice(1) : str));
const stringifySearch = (obj) => {
  const q = new URLSearchParams(Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return q ? `?${q}` : "";
};

export const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
  defaultNotFoundComponent: () => <Navigate to="/" replace />,
  scrollRestoration: false, // the app panel scrolls, not the window; ContentArea keeps per-page scroll
});
