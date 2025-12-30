import express from "express";
import School from "../models/schoolModel.js";
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

// GET /api/dashboard/stats - Get global dashboard statistics
router.get(
  "/stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const activeSchools = await School.countDocuments({ status: "Active" });
      const activeScenarios = await Scenario.countDocuments({});
      const activeEducators = await User.countDocuments({ role: "educator" });
      const activeStudents = await User.countDocuments({ role: "student" });

      res.json({
        activeSchools,
        activeScenarios,
        activeEducators,
        activeStudents,
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
      res.status(500).json({ message: "Server error fetching stats" });
    }
  }
);

// GET /api/dashboard/schools-detailed - Get schools with specific counts for cards
router.get(
  "/schools-detailed",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const schools = await School.find({ status: "Active" }).sort({
        createdAt: -1,
      });

      // Enriched schools data with counts
      // Note: This assumes Users and Scenarios have a 'schoolId' field.
      // If Scenarios are linked to Educators, the query would be more complex,
      // but assuming schoolId exists on Scenarios for now.
      const schoolDataPromises = schools.map(async (school) => {
        const studentCount = await User.countDocuments({
          schoolId: school._id,
          role: "student",
        });
        const educatorCount = await User.countDocuments({
          schoolId: school._id,
          role: "educator",
        });
        const scenarioCount = await Scenario.countDocuments({
          schoolId: school._id,
        });

        return {
          _id: school._id,
          name: school.schoolName,
          students: studentCount,
          educators: educatorCount,
          activeScenarios: scenarioCount,
          assignedAdmin: school.assignedAdmin,
        };
      });

      const detailedSchools = await Promise.all(schoolDataPromises);

      res.json(detailedSchools);
    } catch (error) {
      console.error("Error fetching detailed school data:", error);
      res.status(500).json({ message: "Server error fetching school details" });
    }
  }
);

export default router;
