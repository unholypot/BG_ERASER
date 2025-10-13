const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const databaseService = require('../services/database');

// Get user activity logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const logs = await databaseService.getUserLogs(userId);
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: 'Failed to fetch logs'
    });
  }
});

module.exports = router;