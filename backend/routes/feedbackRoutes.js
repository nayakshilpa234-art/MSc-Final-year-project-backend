const express = require('express');
const router = express.Router();
const { createFeedback, getStats } = require('../controllers/feedbackController');

router.post('/', createFeedback);
router.get('/stats', getStats);

module.exports = router;
