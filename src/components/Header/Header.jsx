// src/components/Container/Header.jsx
import React from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../../AuthContext";

// Icons (example using Heroicons)
import {
  BellIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
// import searchIconPng from "./search.png";

// Helper to format roles for display
const formatRoleForDisplay = (role) => {
  if (!role) return "";
  switch (role.toLowerCase()) {
    case "superadmin":
      return "Super Admin";
    case "educator":
      return "Educator";
    case "school_admin":
      return "School Admin";
    case "student":
      return "Student";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " "); // Basic capitalization for other roles
  }
};

function Header() {
  const { user } = useAuth(); // Only need user for display
  const location = useLocation();

  let pageTitle = "Dashboard";
  const currentPath = location.pathname;

  if (currentPath === "/") pageTitle = "Dashboard";
  else if (currentPath.startsWith("/schools")) pageTitle = "Schools Management";
  else if (currentPath.startsWith("/scenario"))
    pageTitle = "Scenarios Management";
  else if (currentPath.startsWith("/students"))
    pageTitle = "Students Management";
  else if (currentPath.startsWith("/settings")) pageTitle = "Account Settings";
  else if (currentPath.startsWith("/help-center")) pageTitle = "Help & Center";
  else if (currentPath.startsWith("/report")) pageTitle = "Report";

  const showSearchBar = currentPath === "/";

  return (
    <header className="fixed top-0 left-64 right-0 bg-white text-black h-16 flex items-center justify-between px-6 shadow-sm z-40 border-b border-gray-200">
      <div className="flex-1">
        {showSearchBar ? (
          <div className="w-80 relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 border border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        ) : (
          <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center space-x-5">
        <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
          <BellIcon className="h-6 w-6" />
        </button>
        <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
          <QuestionMarkCircleIcon className="h-6 w-6" />
        </button>
        <div className="relative">
          <button className="flex items-center space-x-2 focus:outline-none">
            {user?.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt="User"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <UserCircleIcon className="w-8 h-8 text-gray-500" />
            )}
            {user && (
              <div className="flex flex-col text-xs text-left leading-tight">
                <span className="font-semibold text-gray-700">{user.name}</span>
                <span className="text-xs text-orange-500 font-medium">
                  {formatRoleForDisplay(user.role)}{" "}
                  {/* Use helper for display */}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
