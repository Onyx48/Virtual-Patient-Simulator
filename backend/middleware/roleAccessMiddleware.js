// backend/middleware/roleAccessMiddleware.js
import { hasPermission } from "./rolePermissions.js";

// Middleware to check if user has permission for an action and set scope
// Usage: app.get('/api/students', protect, checkAccess('manageStudents'), ...)
export const checkAccess = (action) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    // Check if role has permission for the action
    if (!hasPermission(userRole, action)) {
      return res.status(403).json({
        message: `User role '${userRole}' is not authorized to perform action: ${action}`,
      });
    }

    // Set scope based on role for data filtering (to be used in routes)
    req.scope = {};
    if (userRole === "school_admin") {
      if (req.user.schoolId) req.scope.schoolId = req.user.schoolId._id; // Filter to admin's school
    } else if (userRole === "educator") {
      req.scope.educatorId = req.user._id; // Filter to educator's students
      if (req.user.schoolId) req.scope.schoolId = req.user.schoolId._id; // Also filter by school
    } else if (userRole === "student") {
      req.scope.userId = req.user._id; // Filter to own data
    }
    // superadmin has no scope restrictions

    next();
  };
};

export default checkAccess;
