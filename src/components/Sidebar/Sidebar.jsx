import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import {
  Squares2X2Icon,
  BuildingLibraryIcon,
  BookOpenIcon,
  UsersIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  FlagIcon,
  VideoCameraIcon,
  ArrowLeftOnRectangleIcon,
} from "@heroicons/react/24/outline";

const hasAccess = (userRole, allowedRoles) => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

function Sidebar({ logo }) {
  const { user, logout } = useAuth();
  const userRole = user?.role;
  // 1. Get the user's ID from the authentication context.
  const userId = user?._id;

  const menuItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: <Squares2X2Icon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: "Schools",
      path: "/schools",
      icon: <BuildingLibraryIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin"],
    },
    {
      name: "Scenarios",
      path: "/scenarios",
      icon: <BookOpenIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin", "educator", "student"],
    },
    {
      name: "Students",
      path: "/students",
      icon: <UsersIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin", "educator"],
    },
    {
      name: "Educators",
      path: "/educators",
      icon: <UsersIcon className="w-5 h-5" />,
      allowedRoles: ["school_admin"],
    },
  ];

  const supportItems = [
    {
      name: "Help & Center",
      path: "/help-center",
      icon: <QuestionMarkCircleIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: "Create Room",
      path: "/create-room", // This is the base path
      icon: <VideoCameraIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <Cog6ToothIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator", "student"],
    },
    {
      name: "Report",
      path: "/report",
      icon: <FlagIcon className="w-5 h-5" />,
      allowedRoles: ["superadmin", "school_admin", "educator"],
    },
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[#0F0F0F] text-gray-400 flex flex-col transition-all duration-300 z-50 font-sans">
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        {logo ? (
          logo
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-orange-600 rounded flex items-center justify-center"></div>
            <span className="text-lg font-bold text-white">VirtualSim</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Main Menu
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

        <div className="my-6 border-t border-gray-800 mx-3"></div>

        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Help & Support
        </p>

        {supportItems.map((item) => {
          // 2. Check if the current user has access to this menu item
          if (!hasAccess(userRole, item.allowedRoles)) {
            return null;
          }

          // 3. Dynamically create the path for "Create Room"
          let finalPath = item.path;
          if (item.name === "Create Room" && userId) {
            finalPath = `${item.path}/${userId}`;
          }

          return (
            <NavLink
              key={item.name}
              to={finalPath} // 4. Use the final, potentially dynamic path
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
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200 group"
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5 group-hover:text-red-400 transition-colors" />
          Log Out
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
