// src/components/Container/Sidebar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext"; // Adjust path as needed

// Icons (install @heroicons/react if you want to use them)
import {
  HomeIcon, AcademicCapIcon, BeakerIcon, UsersIcon, Cog6ToothIcon, QuestionMarkCircleIcon, DocumentChartBarIcon, ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login"); // Redirect to login after logout
  };

  // Define menu items with their roles
  // IMPORTANT: These roles must EXACTLY match the lowercase roles in your userModel.js
  const menuSections = [
    {
      title: "Main Menu",
      items: [
        { id: "dashboard", label: "Dashboard", path: "/", icon: HomeIcon, roles: ['superadmin', 'educator', 'student', 'school_admin'] },
        { id: "schools", label: "Schools", path: "/schools", icon: AcademicCapIcon, roles: ['superadmin', 'educator', 'school_admin'] },
        // SUPERADMIN DOES NOT HAVE SCENARIOS OR STUDENTS
         { id: "scenario", label: "Scenarios", path: "/scenarios", icon: BeakerIcon, roles: ['educator', 'superadmin'] }, // Educator and Superadmin
        { id: "students", label: "Students", path: "/students", icon: UsersIcon, roles: ['educator'] }, // Only Educator (and potentially School Admin)
      ]
    },
    {
      title: "Help & Support",
      items: [
        { id: "help-center", label: "Help & Center", path: "/help-center", icon: QuestionMarkCircleIcon, roles: ['superadmin', 'educator', 'student', 'school_admin'] },
        { id: "settings", label: "Settings", path: "/settings", icon: Cog6ToothIcon, roles: ['superadmin', 'school_admin'] }, // Settings for Super Admin and School Admin
        { id: "report", label: "Report", path: "/report", icon: DocumentChartBarIcon, roles: ['superadmin', 'educator', 'school_admin'] },
      ]
    }
  ];

  const renderMenuItems = (items) => items.map((item) => {
    // Check if the current user has access to this menu item
    // If user is null (not logged in), or if item.roles doesn't include user.role, don't render.
    const hasAccess = user && item.roles.includes(user.role);

    if (!hasAccess) {
      return null; // Don't render the menu item if the user doesn't have access
    }

    // Determine if the link is active
    const isActive = location.pathname === item.path ||
                     (item.path !== "/" && location.pathname.startsWith(item.path)); // For nested routes and general path matching

    return (
      <li key={item.id} className="mb-1">
        <Link
          to={item.path}
          className={`flex items-center w-full text-left px-3 py-2.5 rounded-md transition duration-200 text-sm
            ${ isActive
              ? "bg-orange-500 text-white font-semibold"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
        >
          {item.icon && <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />}
          {item.label}
        </Link>
      </li>
    );
  });

  return (
    <aside className="fixed top-0 bottom-0 left-0 w-64 bg-gray-800 text-white flex flex-col z-50">
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-center px-4 border-b border-gray-700 flex-shrink-0">
        <Link to="/" className="flex items-center">
          <img src="/SIT_Logo.png" alt="SIT Logo" className="h-8 w-auto mr-2" />
          <span className="text-xl font-semibold text-white">SIT Tech</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {menuSections.map(section => (
          <div key={section.title}>
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <ul>{renderMenuItems(section.items)}</ul>
          </div>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-700 mt-auto flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center w-full text-left px-3 py-2.5 rounded-md transition duration-200 text-sm text-gray-300 hover:bg-red-600 hover:text-white"
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-3 flex-shrink-0" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;