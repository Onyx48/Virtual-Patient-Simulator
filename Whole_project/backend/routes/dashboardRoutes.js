import express from 'express';
import School from '../models/schoolModel.js';
import Scenario from '../models/scenarioModel.js';
import User from '../models/userModel.js';

const router = express.Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const activeSchools = await School.countDocuments();
    const activeScenarios = await Scenario.countDocuments();
    const activeEducators = await User.countDocuments({ role: 'educator' });

    res.json({
      activeSchools,
      activeScenarios,
      activeEducators,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error fetching stats' });
  }
});

export default router;