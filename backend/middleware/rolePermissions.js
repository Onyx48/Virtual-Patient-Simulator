// backend/middleware/rolePermissions.js
// Defines permissions for each role: what actions they can perform
// Note: Scope (e.g., own school/students) is enforced in roleAccessMiddleware.js

const rolePermissions = {
  // Actions and the roles allowed to perform them
  manageScenarios: ["educator", "school_admin", "superadmin"], // Create, edit, delete scenarios
  viewScenarios: ["student", "educator", "school_admin", "superadmin"], // View/list scenarios (read-only for student)
  manageStudents: ["educator", "school_admin", "superadmin"], // Manage students (scoped)
  viewStudents: ["educator", "school_admin", "superadmin"], // View students (scoped)
  manageEducators: ["school_admin", "superadmin"], // Manage educators (scoped to school for school_admin)
  viewEducators: ["school_admin", "superadmin"], // View educators (scoped)
  manageSchools: ["superadmin"], // Manage schools
  viewSchools: ["educator", "school_admin", "superadmin"], // View schools
  viewResults: ["educator", "school_admin", "superadmin"], // View results/scores
  manageUsers: ["educator", "school_admin", "superadmin"], // General user management (creation, updates)
  viewDashboard: ["student", "educator", "school_admin", "superadmin"], // Access to dashboard
};

// Helper function to check if a role has permission for an action
export const hasPermission = (role, action) => {
  return rolePermissions[action]?.includes(role) || false;
};

export default rolePermissions;