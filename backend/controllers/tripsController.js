const Trip = require('../models/Trip');

const createImportedBooking = async (req, res) => {
  try {
    const { userId, bookingProvider, bookingId, bookingScreenshot, travelDate, destination, transportDetails, hotelDetails, budgetPlanned } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const trip = await Trip.create({ userId, bookingProvider, bookingId, bookingScreenshot, travelDate: travelDate ? new Date(travelDate) : null, destination, transportDetails, hotelDetails, budgetPlanned });
    return res.json({ success: true, trip });
  } catch (err) {
    console.error('Create imported booking error', err);
    return res.status(500).json({ error: 'Failed to import booking' });
  }
};

const getUserTrips = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId || (req.body && req.body.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const trips = await Trip.find({ userId }).sort({ travelDate: -1 });
    return res.json(trips);
  } catch (err) {
    console.error('Get user trips error', err);
    return res.status(500).json({ error: 'Failed to fetch trips' });
  }
};

const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Not found' });
    return res.json(trip);
  } catch (err) {
    console.error('Get trip error', err);
    return res.status(500).json({ error: 'Failed to fetch trip' });
  }
};

const addExpense = async (req, res) => {
  try {
    const { type, amount, currency, note } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    trip.expenses.push({ type, amount: Number(amount) || 0, currency: currency || 'INR', note: note || '' });
    await trip.save();
    return res.json({ success: true, trip });
  } catch (err) {
    console.error('Add expense error', err);
    return res.status(500).json({ error: 'Failed to add expense' });
  }
};

const addMemory = async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    trip.memories.push(imageBase64);
    await trip.save();
    return res.json({ success: true, trip });
  } catch (err) {
    console.error('Add memory error', err);
    return res.status(500).json({ error: 'Failed to add memory' });
  }
};

module.exports = { createImportedBooking, getUserTrips, getTripById, addExpense, addMemory };
