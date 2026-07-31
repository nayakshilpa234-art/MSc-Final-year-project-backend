const Feedback = require('../models/Feedback');

const createFeedback = async (req, res) => {
  try {
    const { rating, comment, quickTags, userId, chatId, metadata } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const fb = await Feedback.create({ rating, comment: comment || '', quickTags: quickTags || [], userId: userId || '', chatId: chatId || '', metadata: metadata || {} });
    return res.json({ success: true, feedback: fb });
  } catch (err) {
    console.error('Create feedback error', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
};

const getStats = async (req, res) => {
  try {
    const total = await Feedback.countDocuments();
    const agg = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' }, positive: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } }, negative: { $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] } } } }
    ]);
    const avgRating = agg[0] ? Number(agg[0].avgRating.toFixed(2)) : 0;
    const positive = agg[0] ? agg[0].positive : 0;
    const negative = agg[0] ? agg[0].negative : 0;

    // Most common quickTags
    const tagsAgg = await Feedback.aggregate([
      { $unwind: '$quickTags' },
      { $group: { _id: '$quickTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Simple most common words in comments (basic tokenization)
    const comments = await Feedback.find({ comment: { $ne: '' } }).select('comment -_id').lean();
    const stopwords = new Set(['the','and','a','to','is','in','it','of','for','on','that','this','with','i','you','my','me','was','are','be','have','has','but','not']);
    const freq = {};
    comments.forEach(c => {
      const words = (c.comment || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
      words.forEach(w => { if (!stopwords.has(w) && w.length > 2) freq[w] = (freq[w]||0) + 1; });
    });
    const commonWords = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,10).map(w=>({ word: w, count: freq[w] }));

    return res.json({ total, avgRating, positive, negative, commonTags: tagsAgg, commonWords });
  } catch (err) {
    console.error('Feedback stats error', err);
    return res.status(500).json({ error: 'Failed to compute stats' });
  }
};

module.exports = { createFeedback, getStats };
