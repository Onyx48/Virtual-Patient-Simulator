import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import sitLogo from "../../assets/SIT-logo.jpg";
import {
  Squares2X2Icon,
  BuildingLibraryIcon,
  BookOpenIcon,
  UsersIcon,
  Cog6ToothIcon,
  VideoCameraIcon,
  ArrowLeftOnRectangleIcon,
} from "@heroicons/react/24/outline";

const hasAccess = (userRole, allowedRoles) => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

function Sidebar({ logo }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const userRole = user?.role;

  const menuItems = [
    {
      name: t("nav.dashboard"),
      path: "/",
      icon: <Squares2X2Icon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: t("nav.schools"),
      path: "/schools",
      icon: <BuildingLibraryIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin"],
    },
    {
      name: t("nav.scenarios"),
      path: "/scenarios",
      icon: <BookOpenIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin", "educator", "student"],
    },
    {
      name: t("nav.students"),
      path: "/students",
      icon: <UsersIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin", "educator"],
    },
    {
      name: t("nav.educators"),
      path: "/educators",
      icon: <UsersIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin"],
    },
  ];

  const supportItems = [
    {
      name: t("nav.createRoom"),
      /*
       * The hosted simulator, opened directly. This used to point at
       * /create-room/<userId>, which has no route and no page — the click fell
       * through to the catch-all in ContentArea.jsx and silently bounced back to
       * the dashboard, so the button looked broken.
       *
       * Set VITE_SIMULATOR_URL to move it without a code change; the same var
       * drives the educator card's Test button.
       */
      href:
        import.meta.env.VITE_SIMULATOR_URL ||
        "https://share.streampixel.io/6aa14ef480d62d728d8ba6e8",
      icon: <VideoCameraIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: t("nav.settings"),
      path: "/settings",
      icon: <Cog6ToothIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[#0F0F0F] text-gray-400 flex flex-col transition-all duration-300 z-50 font-sans">
      {/*
        Height is content-driven rather than the h-16 it used to be: the logo is
        now h-24 (96px), which cannot fit a 64px bar. This block is the sidebar's
        own header — the main content is offset from Header's top-16, not from
        here — so growing it only pushes the menu down.
      */}
      <div className="flex items-center justify-center px-6 py-6 border-b border-gray-800 bg-black">
        {logo ? (
          logo
        ) : (
          <img
            src={sitLogo}
            alt="Singapore Institute of Technology"
            className="h-24 w-auto object-contain"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {t("nav.mainMenu")}
        </p>

        {menuItems.map((item) =>
          hasAccess(userRole, item.allowedRoles) ? (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-orange-500/10 text-orange-500"
                    : "hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ) : null,
        )}

        {/*
          The divider alone separates these from the main menu. The old "Help &
          Support" heading sat above Create Room and Settings, neither of which is
          help or support.
        */}
        <div className="my-6 border-t border-gray-800 mx-3"></div>

        {supportItems.map((item) => {
          if (!hasAccess(userRole, item.allowedRoles)) {
            return null;
          }

          const linkClasses =
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200";

          /*
           * An item with `href` leaves the app, so it is a plain anchor: a
           * NavLink would try to resolve it as an in-app route. New tab, and
           * noreferrer alongside noopener because the simulator has no business
           * seeing which page sent the student.
           */
          if (item.href) {
            return (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClasses} hover:bg-gray-800 hover:text-white`}
              >
                {item.icon}
                {item.name}
              </a>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `${linkClasses} ${
                  isActive
                    ? "bg-orange-500/10 text-orange-500"
                    : "hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200 group"
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5 group-hover:text-red-400 transition-colors" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

// In your main layout file (e.g., MainLayout.jsx)

// import React from "react";
// import Sidebar from "./Sidebar"; // Adjust the import path
// import CustomLogo from "./CustomLogo"; // Assuming you have a logo component or image

// function MainLayout({ children }) {
// Example 1: Using an <img> tag with a text title
//   const myLogo = (
//     <div className="flex items-center gap-3">
//       <img src="/logo-light.png" alt="My School Logo" className="h-8 w-auto" />
//       <span className="text-lg font-bold text-white">My School</span>
//     </div>
//   );

//   return (
//     <div className="flex">
//       {/* Pass the custom logo JSX to the 'logo' prop */}
//       <Sidebar logo={myLogo} />

//       <main className="flex-1 ml-64 p-8">
//         {children}
//       </main>
//     </div>
//   );
// }

// export default MainLayout;/*
