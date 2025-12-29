// src/utils/roleContent.js
export const getHelpContent = (role) => {
  const content = {
    superadmin: [
      "Manage system-wide settings and configurations.",
      "Oversee all schools, educators, and students.",
      "Access advanced analytics and reports.",
      "Handle user permissions and role assignments.",
    ],
    educator: [
      "Create and manage simulation scenarios.",
      "Assign scenarios to students.",
      "Track student progress and performance.",
      "Access teaching resources and support.",
    ],
    student: [
      "Access assigned simulation scenarios.",
      "Complete interactive learning modules.",
      "View personal progress and scores.",
      "Reach out to educators for assistance.",
    ],
    school_admin: [
      "Manage educators and students within your school.",
      "Oversee scenario assignments and progress.",
      "Access school-level reports and analytics.",
      "Coordinate with educators for curriculum planning.",
    ],
  };
  return content[role] || ["General help and support available. Contact your administrator."];
};

export const getReportContent = (role) => {
  const content = {
    superadmin: [
      "System-wide usage statistics and analytics.",
      "School performance comparisons.",
      "User activity and engagement metrics.",
      "Compliance and audit reports.",
    ],
    educator: [
      "Student progress and completion rates.",
      "Scenario effectiveness and feedback.",
      "Individual student performance analytics.",
      "Classroom engagement insights.",
    ],
    student: [
      "Personal learning progress and achievements.",
      "Scenario completion history.",
      "Performance trends and recommendations.",
      "Access to certificates and badges.",
    ],
    school_admin: [
      "School-wide student performance reports.",
      "Educator activity and scenario usage.",
      "Curriculum effectiveness analytics.",
      "Resource utilization and planning data.",
    ],
  };
  return content[role] || ["General reports available. Contact your administrator."];
};