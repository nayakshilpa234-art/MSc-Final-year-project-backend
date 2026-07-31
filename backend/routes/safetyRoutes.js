const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getSafetyModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// Get emergency contacts for a region
router.get('/emergency/:region', (req, res) => {
    // In a real app, this would query a database of global emergency numbers.
    // We'll hardcode India's numbers as this is an Indian-focused app.
    res.json({
        police: '100',
        ambulance: '102',
        fire: '101',
        touristHelpline: '1363',
        womenHelpline: '1091',
        disasterManagement: '108'
    });
});

// Get AI-generated safety tips
router.get('/tips/:destination', async (req, res) => {
    try {
        const dest = req.params.destination;
        const prompt = `Provide 3 short, specific safety tips for tourists visiting ${dest}. 
        Return ONLY a JSON array of strings. No markdown formatting.`;
        
        const model = getSafetyModel();
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        let tips;
        try {
            tips = JSON.parse(text);
        } catch(e) {
            tips = ["Stay aware of your surroundings.", "Keep your valuables secure.", "Follow local laws and customs."];
        }
        
        res.json({ tips });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get weather warnings
router.get('/weather-warnings', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
        
        // Use Open-Meteo for severe weather alerts (just using precipitation as proxy for now)
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,windspeed_10m_max&timezone=auto`);
        
        const today = response.data.daily;
        const warnings = [];
        
        if (today.precipitation_sum && today.precipitation_sum[0] > 20) {
            warnings.push({ type: 'Rain', message: 'Heavy rain expected today. Carry an umbrella.' });
        }
        if (today.windspeed_10m_max && today.windspeed_10m_max[0] > 40) {
            warnings.push({ type: 'Wind', message: 'Strong winds expected. Avoid coastal edges or high altitudes.' });
        }
        
        if (warnings.length === 0) {
            warnings.push({ type: 'Clear', message: 'Weather looks clear and safe for travel today.' });
        }
        
        res.json({ warnings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
