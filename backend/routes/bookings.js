const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const receiptsDir = path.join(__dirname, '..', 'public', 'uploads', 'receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, receiptsDir)
    },
    filename: function (req, file, cb) {
        cb(null, `receipt-${Date.now()}-${req.params.id}.pdf`)
    }
});
const upload = multer({ storage: storage });

const getAgeCategory = (age) => {
    const parsedAge = Number(age);
    if (Number.isNaN(parsedAge)) return 'Adult';
    if (parsedAge >= 12) return 'Adult';
    if (parsedAge >= 5) return 'Child';
    return 'Infant';
};

const getPricingMultiplier = (ageCategory) => {
    if (ageCategory === 'Adult') return 1.0;
    if (ageCategory === 'Child') return 0.5;
    return 0.0;
};

const detectTravelerProfile = (traveler) => {
    const age = Number(traveler.age) || 0;
    const req = traveler.specialRequirements || {};
    if (req.pregnant) return 'Pregnant Traveler';
    if (req.medicalConditionSupport) return 'Medical Condition Support';
    if (req.petTraveler) return 'Pet Traveler';
    if (req.wheelchair || req.accessibleTransport) return 'Differently-Abled Traveler';
    if (req.seniorAssistance || age >= 60) return 'Senior Citizen';
    if (age >= 5 && age < 12) return 'Child';
    if (age < 5) return 'Infant';
    return 'Adult';
};

const computeTravelerType = (travelers) => {
    if (!Array.isArray(travelers) || travelers.length === 0) return 'Solo Traveler';
    const ages = travelers.map(t => Number(t.age) || 0);
    const hasSenior = ages.some(age => age >= 60);
    const hasChild = ages.some(age => age >= 5 && age < 12);
    const hasInfant = ages.some(age => age >= 0 && age < 5);
    if (hasSenior) return 'Senior Citizen';
    if (ages.length === 1) return 'Solo Traveler';
    if (ages.length === 2 && !hasChild && !hasInfant) return 'Couple';
    if (hasChild || hasInfant) return 'Family';
    return 'Group';
};

const buildPricingBreakdown = (basePrice, travelers) => {
    const counts = travelers.reduce((acc, t) => {
        const category = getAgeCategory(t.age);
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {});
    const totalMultipliers = travelers.reduce((sum, t) => sum + getPricingMultiplier(getAgeCategory(t.age)), 0);
    return {
        basePrice,
        adultCount: counts.Adult || 0,
        childCount: counts.Child || 0,
        infantCount: counts.Infant || 0,
        totalMultipliers,
        finalBasePrice: basePrice * totalMultipliers
    };
};

// Get my bookings (traveler)
router.get('/my', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user.id }).populate('destination').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Get all bookings (admin)
router.get('/', auth, async (req, res) => {
    try {
        const bookings = await Booking.find().populate('destination');
        res.json(bookings);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

const jwt = require('jsonwebtoken');

// Create a booking (public/bot)
router.post('/', async (req, res) => {
    try {
        let payload = req.body;
        const token = req.header('Authorization')?.split(' ')[1];
        if (token && token !== 'null' && token !== 'undefined') {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                payload.user = decoded.user.id;
            } catch(e) {
                console.log('Token verification failed, proceeding as guest:', e.message);
            }
        }
        
        // INTERCEPT DYNAMIC AI GENERATED DESTINATIONS
        if (typeof payload.destination === 'string' && payload.destination.startsWith('dynamic_') && payload.destinationObj) {
            try {
                const newDest = new Destination({
                    name: payload.destinationObj.name || payload.destinationObj.place_name,
                    location: payload.destinationObj.location || "Global Location",
                    category: ["beach", "mountain", "historical", "cultural", "adventure", "religious", "wildlife"].includes(payload.destinationObj.category?.toLowerCase()) ? payload.destinationObj.category.toLowerCase() : "historical",
                    description: payload.destinationObj.description || "Dynamic AI Booking",
                    price: payload.destinationObj.price || 5000,
                    imageUrl: payload.destinationObj.image_url || "https://images.unsplash.com/photo-1488085061387-422e29b40080?q=80&w=1000&auto=format&fit=crop"
                });
                const savedDest = await newDest.save();
                payload.destination = savedDest._id;
            } catch (destErr) {
                if (destErr.code === 11000) {
                    // Destination already exists, fetch it
                    const existingDest = await Destination.findOne({ name: { $regex: new RegExp(`^${payload.destinationObj.name}$`, 'i') } });
                    if (existingDest) {
                        payload.destination = existingDest._id;
                    } else {
                        return res.status(400).json({ msg: 'Failed to create or find destination' });
                    }
                } else {
                    console.error("Destination creation failed:", destErr);
                    return res.status(500).json({ msg: 'Failed to create destination' });
                }
            }
        }

        let destinationPrice = 0;
        if (payload.destinationObj?.price) {
            destinationPrice = Number(payload.destinationObj.price) || 0;
        } else if (payload.destination) {
            try {
                const destinationData = await Destination.findById(payload.destination);
                destinationPrice = destinationData?.price || 0;
            } catch (destFindErr) {
                console.error("Failed to find destination:", destFindErr);
                destinationPrice = 5000; // Fallback price
            }
        }

        if (!Array.isArray(payload.travelers)) {
            payload.travelers = [];
        }

        // Map single form values to travelers array if not already present
        if (payload.travelers.length === 0 && payload.name) {
            payload.travelers.push({
                name: payload.name,
                age: Number(payload.age) || 30,
                gender: payload.gender || 'Male',
                email: payload.email,
                mobile: payload.phone || payload.mobile
            });
        }

        // Ensure at least one traveler
        if (payload.travelers.length === 0) {
            payload.travelers.push({
                name: 'Guest Traveler',
                age: 30,
                gender: 'Male',
                email: payload.email || 'guest@travel.com',
                mobile: payload.phone || '0000000000'
            });
        }

        payload.travelers = payload.travelers.map(traveler => {
            const age = Number(traveler.age) || 0;
            return {
                ...traveler,
                age,
                ageCategory: getAgeCategory(age),
                profileType: detectTravelerProfile(traveler),
                specialRequirements: {
                    wheelchair: traveler.specialRequirements?.wheelchair || false,
                    seniorAssistance: traveler.specialRequirements?.seniorAssistance || false,
                    extraLuggage: traveler.specialRequirements?.extraLuggage || false,
                    mealPreference: traveler.specialRequirements?.mealPreference || 'No Preference',
                    pregnant: traveler.specialRequirements?.pregnant || false,
                    medicalConditionSupport: traveler.specialRequirements?.medicalConditionSupport || false,
                    medicalConditionDetails: traveler.specialRequirements?.medicalConditionDetails || '',
                    petTraveler: traveler.specialRequirements?.petTraveler || false,
                    accessibleTransport: traveler.specialRequirements?.accessibleTransport || false,
                    emergencySupport: traveler.specialRequirements?.emergencySupport || false
                }
            };
        });

        payload.numberOfPeople = Number(payload.numberOfPeople) || payload.travelers.length || 1;
        payload.travelerType = payload.travelerType || computeTravelerType(payload.travelers);
        payload.pricingBreakdown = payload.pricingBreakdown || buildPricingBreakdown(destinationPrice, payload.travelers);
        payload.totalCost = payload.totalCost || payload.pricingBreakdown.finalBasePrice || 0;
        payload.name = payload.name || payload.travelers[0]?.name || 'Primary Traveler';
        payload.email = payload.email || payload.travelers[0]?.email || 'guest@travel.com';
        payload.status = payload.status || 'Pending';
        payload.bookingStatus = payload.bookingStatus || 'Pending';

        const newBooking = new Booking(payload);
        const savedBooking = await newBooking.save();
        res.json(savedBooking);
    } catch (err) {
        console.error("Booking Creation Failed: ", err);
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Duplicate booking detected' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: 'Validation error: ' + err.message });
        }
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// Update booking provider (official redirected bookings)
router.put('/:id/provider', async (req, res) => {
    try {
        const { providerName } = req.body;
        const booking = await Booking.findByIdAndUpdate(
            req.params.id, 
            { 
                providerName, 
                bookingStatus: 'Redirected',
                bookingType: 'Official'
            }, 
            { new: true }
        );
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });
        res.json(booking);
    } catch (err) {
        console.error("Provider update failed: ", err);
        res.status(500).send('Server Error');
    }
});

// Check booking status (public/bot)
router.get('/:id/status', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('destination');
        if (!booking) return res.status(404).json({ msg: 'Not found' });
        res.json({ status: booking.status, destination: booking.destination });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Complete booking with post-booking selections (public/bot)
router.put('/:id/complete', async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(booking);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update booking status (admin)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.json(booking);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete a booking (admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Booking deleted' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Upload receipt PDF
router.post('/:id/receipt', upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No receipt file provided.' });
        }
        const receiptPdfPath = `/uploads/receipts/${req.file.filename}`;
        
        // Generate pseudo transaction/invoice if missing
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });
        
        const invoiceNumber = booking.invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const transactionId = booking.transactionId || `TXN${Math.floor(10000000 + Math.random() * 90000000)}`;
        
        await Booking.findByIdAndUpdate(req.params.id, { 
            receiptPdfPath,
            invoiceNumber,
            transactionId
        });
        
        res.json({ receiptPdfPath, invoiceNumber, transactionId });
    } catch (err) {
        console.error('Error uploading receipt:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
