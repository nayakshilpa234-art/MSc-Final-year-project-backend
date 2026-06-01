const mongoose = require('mongoose');

const communityPlaceSchema = new mongoose.Schema({
    placeName: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // e.g., "hidden-gem", "local-food", "scenic"
    location: { type: String, required: true },
    coordinates: {
        lat: Number,
        lng: Number
    },
    images: [{ type: String }], // URLs
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: Number,
        comment: String,
        date: { type: Date, default: Date.now }
    }],
    isApproved: { type: Boolean, default: false },
    isHiddenGem: { type: Boolean, default: true },
    tags: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommunityPlace', communityPlaceSchema);
