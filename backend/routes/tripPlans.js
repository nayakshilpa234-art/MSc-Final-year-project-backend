const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TripPlan = require('../models/TripPlan');

// Get all trip plans
router.get('/', async (req, res) => {
    try {
        const tripPlans = await TripPlan.find();
        res.json(tripPlans);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Add a trip plan
router.post('/', auth, async (req, res) => {
    try {
        const newTripPlan = new TripPlan(req.body);
        const savedTripPlan = await newTripPlan.save();
        res.json(savedTripPlan);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update a trip plan
router.put('/:id', auth, async (req, res) => {
    try {
        const tripPlan = await TripPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(tripPlan);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete a trip plan
router.delete('/:id', auth, async (req, res) => {
    try {
        await TripPlan.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Trip Plan deleted' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Record a view for a trip plan
router.post('/:id/view', async (req, res) => {
    try {
        const trip = await TripPlan.findById(req.params.id);
        if (trip) {
            trip.views = (trip.views || 0) + 1;
            trip.popularityScore = ((trip.views || 0) * 0.1) + ((trip.bookings || 0) * 5) + ((trip.likes || 0) * 0.5);
            await trip.save();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Record a like for a trip plan
router.post('/:id/like', async (req, res) => {
    try {
        const trip = await TripPlan.findById(req.params.id);
        if (trip) {
            trip.likes = (trip.likes || 0) + 1;
            trip.popularityScore = ((trip.views || 0) * 0.1) + ((trip.bookings || 0) * 5) + ((trip.likes || 0) * 0.5);
            await trip.save();
        }
        res.json({ success: true, likes: trip.likes });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// AI Recommendations
router.post('/recommendations', async (req, res) => {
    try {
        const { history = [], wishlist = [] } = req.body;
        
        // Fetch all trips for AI to pick from
        const allTrips = await TripPlan.find().select('_id destination state category tags rating price');
        
        if (history.length === 0 && wishlist.length === 0) {
            // Default to most popular if no history
            const popular = await TripPlan.find().sort({ popularityScore: -1 }).limit(4);
            return res.json(popular);
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
        You are a travel recommendation engine.
        User's recent history of package IDs: ${JSON.stringify(history)}
        User's wishlist package IDs: ${JSON.stringify(wishlist)}
        
        Available packages: ${JSON.stringify(allTrips)}
        
        Based on the user's history and wishlist, select the top 4 most relevant packages from the available list that the user has NOT seen or wishlisted yet.
        Return ONLY a raw JSON array of the recommended package _ids. 
        Example: ["id1", "id2"]
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        if (text.startsWith('\`\`\`json')) text = text.substring(7, text.length - 3).trim();
        
        let recommendedIds = [];
        try {
            recommendedIds = JSON.parse(text);
        } catch (e) {
            // fallback
            const popular = await TripPlan.find().sort({ popularityScore: -1 }).limit(4);
            return res.json(popular);
        }

        const recommendations = await TripPlan.find({ _id: { $in: recommendedIds } });
        res.json(recommendations);
    } catch (err) {
        console.error('[AI Recommendation Error]:', err.message || 'Failed to fetch AI recommendations');
        // Fallback to popular
        const popular = await TripPlan.find().sort({ popularityScore: -1 }).limit(4);
        res.json(popular);
    }
});

// AI Compare Packages
router.post('/compare-ai', async (req, res) => {
    try {
        const { packageIds } = req.body;
        if (!packageIds || packageIds.length < 2) {
            return res.status(400).json({ msg: 'Need at least 2 packages to compare.' });
        }

        const tripsToCompare = await TripPlan.find({ _id: { $in: packageIds } });

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
        You are an expert travel comparison engine.
        Compare these ${tripsToCompare.length} travel packages:
        ${JSON.stringify(tripsToCompare.map(t => ({ id: t._id, name: t.destination, price: t.price, duration: t.duration, highlights: t.highlights, activities: t.activities })))}
        
        Evaluate them and determine the WINNING package ID for each of the following categories:
        1. "bestValue": Best Value for Money
        2. "bestFamily": Best for Families
        3. "bestCouple": Best for Couples
        4. "bestAdventure": Best Adventure Package
        5. "bestLuxury": Best Luxury Package
        6. "mostBudgetFriendly": Most Budget-Friendly
        7. "mostPopular": Most Popular Choice
        
        Return ONLY a JSON object mapping the category key to the winning package ID. Example:
        { "bestValue": "id_1", "bestFamily": "id_2" }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            const aiEvaluation = JSON.parse(text);
            res.json(aiEvaluation);
        } catch (e) {
            res.json({});
        }
    } catch (err) {
        console.error('[AI Compare Error]:', err.message || 'Failed to fetch AI comparison');
        res.json({}); // Silently fail and just don't show AI badges if error occurs
    }
});

module.exports = router;
