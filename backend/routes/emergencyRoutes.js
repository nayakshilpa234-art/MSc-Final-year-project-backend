const express = require('express');
const router = express.Router();
const { handleEmergency } = require('../controllers/emergencyController');

// POST /api/emergency
router.post('/', handleEmergency);

module.exports = router;
