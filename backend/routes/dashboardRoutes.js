import express from "express";
import School from "../models/schoolModel.js";
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
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

// GET /api/dashboard/student-stats - Get student dashboard statistics
router.get(
  "/student-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const studentId = req.user._id.toString();

      console.log("DEBUG student-stats - studentId:", studentId);
      console.log("DEBUG student-stats - user:", req.user.name);

      // Get all scenarios assigned to this student
      const assignedScenarios = await Scenario.find({
        assignedTo: studentId,
      }).select("_id scenarioName");

      console.log("DEBUG student-stats - assignedScenarios count:", assignedScenarios.length);

      const totalAssigned = assignedScenarios.length;

      if (totalAssigned === 0) {
        return res.json({
          completedCount: 0,
          availableCount: 0,
          averageScore: null,
          scenarioScores: [],
          totalAssigned: 0,
        });
      }

      // Get all sessions for this student (student_id is stored as string)
      const sessions = await Session.find({ student_id: studentId });
      console.log("DEBUG student-stats - sessions found:", sessions.length);

      // Find best score per scenario
      const scenarioBestScores = {};
      const completedScenarioIds = new Set();

      sessions.forEach((session) => {
        const scenarioId = session.scenario_id.toString();
        if (!scenarioBestScores[scenarioId] || session.score > scenarioBestScores[scenarioId].score) {
          scenarioBestScores[scenarioId] = {
            score: session.score,
            sessionId: session._id,
          };
        }
        completedScenarioIds.add(scenarioId);
      });

      // Build scenario scores array with scenario names
      const scenarioScores = assignedScenarios.map((scenario) => {
        const bestScore = scenarioBestScores[scenario._id.toString()];
        return {
          scenarioId: scenario._id,
          scenarioName: scenario.scenarioName,
          bestScore: bestScore ? bestScore.score : null,
          isCompleted: completedScenarioIds.has(scenario._id.toString()),
        };
      });

      // Calculate stats
      const completedCount = completedScenarioIds.size;
      const availableCount = totalAssigned - completedCount;

      // Calculate average score from best scores (only completed scenarios)
      const scores = Object.values(scenarioBestScores).map((s) => s.score);
      const averageScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
        : null;

      res.json({
        completedCount,
        availableCount,
        averageScore,
        scenarioScores,
        totalAssigned,
      });
    } catch (error) {
      console.error("Error fetching student stats:", error);
      res.status(500).json({ message: "Server error fetching student stats" });
    }
  }
);

export default router;
