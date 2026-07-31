const express = require('express');
const router = express.Router();
const TravelStory = require('../models/TravelStory');
const Booking = require('../models/Booking');
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getStoryModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// Generate story from booking
router.post('/generate', async (req, res) => {
    try {
        const { bookingId, userId } = req.body;
        
        // Find booking
        const booking = await Booking.findById(bookingId).populate('destination');
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        
        const destName = booking.destination ? booking.destination.name : 'Unknown Destination';
        
        // Generate AI story
        const prompt = `Write a beautiful travel diary and summary for a trip to ${destName}. 
        The traveler spent ₹${booking.totalCost || 0} in total.
        Return ONLY a JSON object with two fields:
        {
            "diary": "A day-by-day narrative of the trip...",
            "summary": "A short poetic summary of the experience."
        }
        Do not include markdown blocks around the JSON.`;
        
        const model = getStoryModel();
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        let aiContent;
        try {
            aiContent = JSON.parse(responseText);
        } catch(e) {
            aiContent = { diary: "An amazing journey filled with beautiful memories.", summary: "A trip to remember forever." };
        }
        
        // Create story
        const story = new TravelStory({
            userId,
            bookingId,
            title: `My Journey to ${destName}`,
            destination: destName,
            startDate: booking.travelDate,
            totalBudget: booking.totalCost,
            budgetBreakdown: {
                transport: booking.transport ? (booking.transport.cost || 0) : 0,
                stay: booking.stay ? (booking.stay.cost || 0) : 0,
                food: booking.food ? (booking.food.cost || 0) : 0
            },
            diary: aiContent.diary,
            summary: aiContent.summary
        });
        
        await story.save();
        
        // Update booking
        booking.tripCompleted = true;
        booking.completedAt = new Date();
        booking.travelStoryGenerated = true;
        await booking.save();
        
        res.status(201).json(story);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's stories
router.get('/user/:userId', async (req, res) => {
    try {
        const stories = await TravelStory.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(stories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single story
router.get('/:id', async (req, res) => {
    try {
        const story = await TravelStory.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });
        res.json(story);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
