import express from "express";
import School from "../models/schoolModel.js";
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import {
  assignedStudentIdsByScenario,
  assignedToStudentQuery,
} from "../utils/scenarioAssignment.js";

const router = express.Router();

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
  },
);

router.get(
  "/schools-detailed",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const schools = await School.find({ status: "Active" }).sort({
        createdAt: -1,
      });

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
  },
);

router.get(
  "/student-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const studentId = req.user._id.toString();

      // Individually assigned plus everything assigned to this student's group.
      const assignedScenarios = await Scenario.find(
        assignedToStudentQuery(req.user),
      ).select("_id scenarioName");

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

      const sessions = await Session.find({ student_id: studentId });

      const scenarioBestScores = {};
      const completedScenarioIds = new Set();

      sessions.forEach((session) => {
        const scenarioId = session.scenario_id.toString();
        if (
          !scenarioBestScores[scenarioId] ||
          session.score > scenarioBestScores[scenarioId].score
        ) {
          scenarioBestScores[scenarioId] = {
            score: session.score,
            sessionId: session._id,
          };
        }
        completedScenarioIds.add(scenarioId);
      });

      const scenarioScores = assignedScenarios.map((scenario) => {
        const bestScore = scenarioBestScores[scenario._id.toString()];
        return {
          scenarioId: scenario._id,
          scenarioName: scenario.scenarioName,
          bestScore: bestScore ? bestScore.score : null,
          isCompleted: completedScenarioIds.has(scenario._id.toString()),
        };
      });

      const completedCount = completedScenarioIds.size;
      const availableCount = totalAssigned - completedCount;

      const scores = Object.values(scenarioBestScores).map((s) => s.score);
      const averageScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
            )
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
  },
);

router.get(
  "/monthly-activity",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;

      if (userRole === "educator") {
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const sessionMatch = { createdAt: { $gte: sixMonthsAgo } };
      const userMatch = { role: "student" };

      if (schoolId) {
        userMatch.schoolId = schoolId;
      }

      const students = await User.find(userMatch).select("_id");
      const studentIds = students.map((s) => s._id);

      if (schoolId) {
        sessionMatch.student_id = {
          $in: studentIds.map((id) => id.toString()),
        };
      }

      const monthlySessions = await Session.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            completed: { $sum: 1 },
            totalScore: { $sum: "$score" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const result = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthName = monthNames[date.getMonth()];

        const monthData = monthlySessions.find(
          (m) => m._id.year === year && m._id.month === month,
        );

        result.push({
          name: monthName,
          completed: monthData ? monthData.completed : 0,
          active: monthData ? Math.ceil(monthData.completed * 0.7) : 0,
          inactive: monthData ? Math.floor(monthData.completed * 0.3) : 0,
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching monthly activity:", error);
      res
        .status(500)
        .json({ message: "Server error fetching monthly activity" });
    }
  },
);

router.get(
  "/teaching-effectiveness",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;
      let educatorId = null;

      if (userRole === "educator") {
        educatorId = req.user._id;
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const userMatch = { role: "student" };
      if (schoolId) userMatch.schoolId = schoolId;

      const students = await User.find(userMatch).select("_id");
      const studentIds = students.map((s) => s._id);

      const scenarioMatch = {};
      if (schoolId) scenarioMatch.schoolId = schoolId;
      if (educatorId) scenarioMatch.educator = educatorId;

      const scenarios = await Scenario.find(scenarioMatch).select(
        "_id assignedTo assignedGroups",
      );
      let totalAssigned = 0;
      let totalCompleted = 0;

      // Group members count as assigned, so the total is taken from the unioned
      // student set rather than the assignedTo array alone.
      const assignedIdsByScenario = await assignedStudentIdsByScenario(scenarios);
      const inScope = new Set(studentIds.map((id) => id.toString()));

      scenarios.forEach((scenario) => {
        const ids = assignedIdsByScenario.get(scenario._id.toString());
        totalAssigned += [...ids].filter((id) => inScope.has(id)).length;
      });

      const sessionMatch = {};
      if (studentIds.length > 0) {
        sessionMatch.student_id = {
          $in: studentIds.map((id) => id.toString()),
        };
      }

      const sessions = await Session.find(sessionMatch);

      // Count unique (student_id, scenario_id) pairs that have at least one session
      const completedPairs = new Set();
      sessions.forEach((session) => {
        completedPairs.add(`${session.student_id}::${session.scenario_id}`);
      });

      totalCompleted = completedPairs.size;

      const completionRate =
        totalAssigned > 0
          ? Math.min(100, Math.round((totalCompleted / totalAssigned) * 100))
          : 0;

      const scores = sessions.map((s) => s.score);
      const avgScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
            )
          : 0;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const recentSessions = await Session.countDocuments({
        student_id: { $in: studentIds.map((id) => id.toString()) },
        createdAt: { $gte: thirtyDaysAgo },
      });

      const previousSessions = await Session.countDocuments({
        student_id: { $in: studentIds.map((id) => id.toString()) },
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      });

      const engagementChange =
        previousSessions > 0
          ? Math.round(
              ((recentSessions - previousSessions) / previousSessions) * 100,
            )
          : recentSessions > 0
            ? 100
            : 0;

      res.json({
        effectiveness: completionRate,
        avgScore,
        engagementChange,
        totalAssigned,
        totalCompleted,
      });
    } catch (error) {
      console.error("Error fetching teaching effectiveness:", error);
      res
        .status(500)
        .json({ message: "Server error fetching teaching effectiveness" });
    }
  },
);

router.get(
  "/scenario-popularity",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;
      let educatorId = null;

      if (userRole === "educator") {
        educatorId = req.user._id;
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const scenarioMatch = {};
      if (schoolId) scenarioMatch.schoolId = schoolId;
      if (educatorId) scenarioMatch.educator = educatorId;

      const scenarios = await Scenario.find(scenarioMatch).select(
        "_id scenarioName assignedTo assignedGroups",
      );
      const assignedIdsByScenario = await assignedStudentIdsByScenario(scenarios);

      const scenarioIds = scenarios.map((s) => s._id);

      const sessionCounts = await Session.aggregate([
        {
          $match: {
            scenario_id: { $in: scenarioIds.map((id) => id.toString()) },
          },
        },
        { $group: { _id: "$scenario_id", sessionCount: { $sum: 1 } } },
      ]);

      const colors = [
        "#6b7280",
        "#d97706",
        "#a16207",
        "#e5e7eb",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
        "#f59e0b",
      ];
      const result = scenarios.map((scenario, index) => {
        const sessionCount =
          sessionCounts.find((s) => s._id === scenario._id.toString())
            ?.sessionCount || 0;
        const assignmentCount =
          assignedIdsByScenario.get(scenario._id.toString())?.size || 0;
        const total = sessionCount + assignmentCount;

        return {
          name: scenario.scenarioName || "Untitled Scenario",
          value: total,
          sessionCount,
          assignmentCount,
          color: colors[index % colors.length],
        };
      });

      result.sort((a, b) => b.value - a.value);

      res.json(result);
    } catch (error) {
      console.error("Error fetching scenario popularity:", error);
      res
        .status(500)
        .json({ message: "Server error fetching scenario popularity" });
    }
  },
);

router.get(
  "/educator-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const educatorId = req.user._id;
      const schoolId = req.user.schoolId;

      // Find students via their school (supervisor may not be populated for all)
      const students = await User.find({
        role: "student",
        schoolId: schoolId,
      }).select("_id");

      const studentIds = students.map((s) => s._id);
      const totalStudents = students.length;

      const scenarios = await Scenario.find({ educator: educatorId });
      const totalScenarios = scenarios.length;
      const activeScenariosCount = scenarios.filter(
        (s) => s.status === "Published",
      ).length;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const currentMonthStudents = await User.countDocuments({
        role: "student",
        schoolId: schoolId,
        createdAt: { $gte: startOfMonth },
      });

      const lastMonthStudents = await User.countDocuments({
        role: "student",
        schoolId: schoolId,
        createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth },
      });

      const studentGrowth =
        lastMonthStudents > 0
          ? Math.round(
              ((currentMonthStudents - lastMonthStudents) / lastMonthStudents) *
                100,
            )
          : currentMonthStudents > 0
            ? 100
            : 0;

      const currentMonthScenarios = await Scenario.countDocuments({
        educator: educatorId,
        createdAt: { $gte: startOfMonth },
      });

      const lastMonthScenarios = await Scenario.countDocuments({
        educator: educatorId,
        createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth },
      });

      const scenarioGrowth =
        lastMonthScenarios > 0
          ? currentMonthScenarios - lastMonthScenarios
          : currentMonthScenarios;

      let avgProgress = 0;
      let avgTimeSpent = 0;
      let avgProgressChange = 0;

      if (studentIds.length > 0) {
        const sessions = await Session.find({
          student_id: { $in: studentIds.map((id) => id.toString()) },
        });

        if (sessions.length > 0) {
          const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
          avgProgress = Math.round((totalScore / sessions.length) * 100);

          avgTimeSpent = Math.round(((sessions.length * 5) / 60) * 10) / 10;

          const recentSessions = sessions.filter(
            (s) => s.createdAt >= startOfMonth,
          );
          const prevSessions = sessions.filter(
            (s) =>
              s.createdAt >= startOfLastMonth && s.createdAt < startOfMonth,
          );

          if (prevSessions.length > 0 && recentSessions.length > 0) {
            const recentAvg =
              recentSessions.reduce((sum, s) => sum + s.score, 0) /
              recentSessions.length;
            const prevAvg =
              prevSessions.reduce((sum, s) => sum + s.score, 0) /
              prevSessions.length;
            avgProgressChange = Math.round(
              ((recentAvg - prevAvg) / prevAvg) * 100,
            );
          }
        }
      }

      res.json({
        totalStudents,
        studentGrowth,
        totalScenarios,
        scenarioGrowth,
        activeScenariosCount,
        avgProgress,
        avgProgressChange,
        avgTimeSpent,
      });
    } catch (error) {
      console.error("Error fetching educator stats:", error);
      res.status(500).json({ message: "Server error fetching educator stats" });
    }
  },
);

router.get(
  "/school-admin-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const schoolId = req.user.schoolId;

      const students = await User.find({
        role: "student",
        schoolId: schoolId,
      }).select("_id createdAt");
      const studentIds = students.map((s) => s._id);

      const educators = await User.find({
        role: "educator",
        schoolId: schoolId,
      }).select("_id createdAt");

      const scenarios = await Scenario.find({ schoolId: schoolId }).select(
        "createdAt",
      );

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const chartData = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = monthNames[month];

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const monthStudents = students.filter(
          (s) => s.createdAt >= startOfMonth && s.createdAt <= endOfMonth,
        ).length;

        const monthEducators = educators.filter(
          (e) => e.createdAt >= startOfMonth && e.createdAt <= endOfMonth,
        ).length;

        const monthScenarios = scenarios.filter(
          (s) => s.createdAt >= startOfMonth && s.createdAt <= endOfMonth,
        ).length;

        chartData.push({
          name: monthName,
          students: monthStudents,
          educators: monthEducators,
          scenarios: monthScenarios,
        });
      }

      res.json({
        totalStudents: students.length,
        totalEducators: educators.length,
        totalScenarios: scenarios.length,
        chartData,
      });
    } catch (error) {
      console.error("Error fetching school admin stats:", error);
      res
        .status(500)
        .json({ message: "Server error fetching school admin stats" });
    }
  },
);

export default router;
