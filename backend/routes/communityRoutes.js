const express = require('express');
const router = express.Router();
const CommunityPlace = require('../models/CommunityPlace');
const { verifyToken } = require('../middleware/authMiddleware');

// Get all approved community places
router.get('/approved', async (req, res) => {
    try {
        const places = await CommunityPlace.find({ isApproved: true }).populate('submittedBy', 'name');
        res.json(places);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get pending places (admin only ideally, but keeping it simple for now)
router.get('/pending', async (req, res) => {
    try {
        const places = await CommunityPlace.find({ isApproved: false }).populate('submittedBy', 'name');
        res.json(places);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit a new place
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const newPlace = new CommunityPlace({
            ...req.body,
            submittedBy: req.user.id
        });
        await newPlace.save();
        res.status(201).json({ message: 'Place submitted successfully. Pending admin approval.', place: newPlace });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve a place
router.put('/approve/:id', async (req, res) => {
    try {
        const place = await CommunityPlace.findByIdAndUpdate(
            req.params.id,
            { isApproved: true },
            { new: true }
        );
        res.json({ message: 'Place approved successfully', place });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete/Reject a place
router.delete('/:id', async (req, res) => {
    try {
        await CommunityPlace.findByIdAndDelete(req.params.id);
        res.json({ message: 'Place deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add review to a place
router.post('/:id/review', verifyToken, async (req, res) => {
    try {
        const place = await CommunityPlace.findById(req.params.id);
        if (!place) return res.status(404).json({ error: 'Place not found' });

        const review = {
            userId: req.user.id,
            rating: req.body.rating,
            comment: req.body.comment,
            date: new Date()
        };

        place.reviews.push(review);
        
        // Update average rating
        const totalRating = place.reviews.reduce((sum, r) => sum + r.rating, 0);
        place.rating = totalRating / place.reviews.length;
        place.reviewCount = place.reviews.length;

        await place.save();
        res.json(place);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
