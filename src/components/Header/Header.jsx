import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";

import {
  QuestionMarkCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

const formatRoleForDisplay = (role, t) => {
  if (!role) return "";
  switch (role.toLowerCase()) {
    case "superadmin":
      return t("role.superadmin");
    case "educator":
      return t("role.educator");
    case "school_admin":
      return t("role.school_admin");
    case "student":
      return t("role.student");
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
  }
};

function Header() {
  const { user } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  let pageTitle = t("page.dashboard");
  const currentPath = location.pathname;

  if (currentPath === "/") pageTitle = t("page.dashboard");
  else if (currentPath.startsWith("/schools")) pageTitle = t("page.schools");
  else if (currentPath.startsWith("/scenario"))
    pageTitle = t("page.scenarios");
  else if (currentPath.startsWith("/students"))
    pageTitle = t("page.students");
  else if (currentPath.startsWith("/settings")) pageTitle = t("page.settings");

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
              placeholder={t("header.search")}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 border border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        ) : (
          <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center space-x-5">
        {/* Language switcher — a segmented EN | 日本語 control. The active
            language is highlighted, so its meaning is clear in either mode.
            data-no-i18n keeps the DOM translator from touching it. */}
        <div
          data-no-i18n
          className="flex items-center rounded-md border border-orange-500 overflow-hidden text-sm font-semibold select-none"
        >
          <button
            type="button"
            onClick={() => language !== "en" && toggleLanguage()}
            className={`px-2.5 py-1 transition-colors ${
              language === "en"
                ? "bg-orange-500 text-white"
                : "text-orange-600 hover:bg-orange-50"
            }`}
            aria-pressed={language === "en"}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => language !== "ja" && toggleLanguage()}
            className={`px-2.5 py-1 transition-colors ${
              language === "ja"
                ? "bg-orange-500 text-white"
                : "text-orange-600 hover:bg-orange-50"
            }`}
            aria-pressed={language === "ja"}
          >
            日本語
          </button>
        </div>
        <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
          <QuestionMarkCircleIcon className="h-6 w-6" />
        </button>
        <div className="relative">
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center space-x-2 focus:outline-none"
          >
            {/* {user?.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt="User"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : ( */}
              <UserCircleIcon className="w-8 h-8 text-gray-500" />
            {/* )} */}
            {user && (
              <div className="flex flex-col text-xs text-left leading-tight">
                <span className="font-semibold text-gray-700">{user.name}</span>
                <span className="text-xs text-orange-500 font-medium">
                  {formatRoleForDisplay(user.role, t)}{" "}
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
