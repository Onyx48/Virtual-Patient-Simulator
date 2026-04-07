const rolePermissions = {
  manageScenarios: ["educator"],

  viewScenarios: ["student", "educator", "school_admin", "superadmin"],

  manageStudents: ["educator", "superadmin"],
  viewStudents: ["educator", "school_admin", "superadmin"],
  manageEducators: ["school_admin", "superadmin"],
  viewEducators: ["school_admin", "superadmin"],
  manageSchools: ["superadmin"],
  viewSchools: ["educator", "school_admin", "superadmin"],
  viewResults: ["educator", "school_admin", "superadmin"],
  manageUsers: ["educator", "school_admin", "superadmin"],
  viewDashboard: ["student", "educator", "school_admin", "superadmin"],
};

export const hasPermission = (role, action) => {
  return rolePermissions[action]?.includes(role) || false;
};

export default rolePermissions;
