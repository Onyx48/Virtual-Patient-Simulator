import { hasPermission } from "./rolePermissions.js";

export const checkAccess = (action) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    if (!hasPermission(userRole, action)) {
      return res.status(403).json({
        message: `User role '${userRole}' is not authorized to perform action: ${action}`,
      });
    }

    req.scope = {};
    if (userRole === "school_admin") {
      if (!req.user.schoolId) {
        return res.status(403).json({
          message:
            "School admin account is not assigned to a school. Please contact superadmin.",
        });
      }
      req.scope.schoolId = req.user.schoolId._id;
    } else if (userRole === "educator") {
      req.scope.educatorId = req.user._id;
      req.scope.schoolId = req.user.schoolId ? req.user.schoolId._id : null;
    } else if (userRole === "student") {
      req.scope.userId = req.user._id;
    }

    next();
  };
};

export default checkAccess;
