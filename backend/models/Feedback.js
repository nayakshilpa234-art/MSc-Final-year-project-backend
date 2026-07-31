const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  chatId: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  quickTags: { type: [String], default: [] },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
