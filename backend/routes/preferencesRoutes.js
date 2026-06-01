const express = require('express');
const router = express.Router();
const UserPreferences = require('../models/UserPreferences');

// Get user preferences
router.get('/:userId', async (req, res) => {
    try {
        let prefs = await UserPreferences.findOne({ userId: req.params.userId });
        if (!prefs) {
            // Return default if not exists
            prefs = new UserPreferences({ userId: req.params.userId });
        }
        res.json(prefs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update preferences
router.put('/:userId', async (req, res) => {
    try {
        const prefs = await UserPreferences.findOneAndUpdate(
            { userId: req.params.userId },
            { $set: req.body },
            { new: true, upsert: true }
        );
        res.json(prefs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Log a completed trip
router.post('/trip', async (req, res) => {
    try {
        const { userId, destination, duration, rating, notes } = req.body;
        const prefs = await UserPreferences.findOneAndUpdate(
            { userId },
            { 
                $push: { 
                    previousTrips: { destination, date: new Date(), duration, rating, notes } 
                } 
            },
            { new: true, upsert: true }
        );
        res.json(prefs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get AI memory context string
router.get('/memory/:userId', async (req, res) => {
    try {
        const prefs = await UserPreferences.findOne({ userId: req.params.userId });
        if (!prefs) return res.json({ context: 'No specific user preferences saved yet.' });

        let context = `User Preferences:\n`;
        context += `- Budget: ${prefs.budgetPreference}\n`;
        context += `- Dietary: ${prefs.dietaryPreference}\n`;
        if (prefs.favoriteDestinations && prefs.favoriteDestinations.length > 0) {
            context += `- Favorite Destinations: ${prefs.favoriteDestinations.join(', ')}\n`;
        }
        if (prefs.travelStyle && prefs.travelStyle.length > 0) {
            context += `- Travel Style: ${prefs.travelStyle.join(', ')}\n`;
        }
        if (prefs.previousTrips && prefs.previousTrips.length > 0) {
            context += `- Previous Trips: ${prefs.previousTrips.map(t => t.destination).join(', ')}\n`;
        }
        
        res.json({ context, language: prefs.preferredLanguage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
