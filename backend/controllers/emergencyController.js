const EmergencyLog = require('../models/EmergencyLog');
const { generateResponse, detectType } = require('../services/EmergencyAssistanceService');
const jwt = require('jsonwebtoken');

async function handleEmergency(req, res) {
  try {
    const { query, lat, lng, tripId } = req.body;
    const token = req.header('Authorization')?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.user.id;
      } catch (e) {}
    }

    const { aiResponse, type, nearby } = await generateResponse({ query, lat, lng });

    const log = new EmergencyLog({
      user: userId,
      query,
      aiResponse,
      location: lat && lng ? { lat, lng } : undefined,
      tripId: tripId || undefined,
      meta: { type, nearby }
    });
    await log.save();

    res.json({ success: true, type, aiResponse, nearby });
  } catch (err) {
    console.error('Emergency handler error', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleEmergency };
