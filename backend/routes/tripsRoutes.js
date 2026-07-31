const express = require('express');
const router = express.Router();
const { createImportedBooking, getUserTrips, getTripById, addExpense, addMemory } = require('../controllers/tripsController');

router.post('/import', createImportedBooking);
router.get('/user/:userId', getUserTrips);
router.get('/:id', getTripById);
router.post('/:id/expense', addExpense);
router.post('/:id/memory', addMemory);

module.exports = router;
