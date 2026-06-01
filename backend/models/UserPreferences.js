const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    favoriteDestinations: [{ type: String }],
    budgetPreference: { type: String, enum: ['budget', 'mid-range', 'luxury'], default: 'mid-range' },
    travelStyle: [{ type: String }], // e.g. adventure, relaxation, cultural
    dietaryPreference: { type: String, enum: ['veg', 'non-veg', 'both'], default: 'both' },
    previousTrips: [{
        destination: String,
        date: Date,
        duration: Number,
        rating: Number,
        notes: String
    }],
    preferredLanguage: { type: String, enum: ['en', 'hi', 'kn'], default: 'en' },
    emergencyContacts: [{
        name: String,
        phone: String,
        relation: String
    }],
    moodHistory: [{
        mood: String,
        date: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
