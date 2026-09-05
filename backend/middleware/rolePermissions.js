const rolePermissions = {
  manageScenarios: ["educator"],

  // Editing/deleting an existing scenario. Kept separate from manageScenarios so
  // a school_admin can moderate their school's scenarios without also gaining
  // the ability to author new ones (creation would set them as the educator).
  // The route handlers still restrict school_admin to their own school.
  moderateScenarios: ["educator", "school_admin"],

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
