try {
  require('dotenv').config();
} catch (_) {
  /* Vercel injects env vars; dotenv optional when bundled */
}

const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const Payment = require('./models/Payment');
const { connectDB } = require('./db');
require('./services/reviewCron'); // Initialize the automated review email service
const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL || process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'https://m-sc-final-year-project.vercel.app',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '10mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(503).json({ ok: false, database: 'disconnected', msg: err.message });
  }
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    const msg = err.message.includes('MONGO_URI')
      ? err.message
      : `Database unavailable: ${err.message}`;
    res.status(503).json({ msg });
  }
});

app.use('/api/chat', require('./routes/chat'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/destinations', require('./routes/destinations'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/transports', require('./routes/transports'));
app.use('/api/tripPlans', require('./routes/tripPlans'));
app.use('/api/preferences', require('./routes/preferencesRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api/stories', require('./routes/travelStoryRoutes'));
app.use('/api/nearby', require('./routes/nearbyRoutes'));
app.use('/api/safety', require('./routes/safetyRoutes'));
app.use('/api/emergency', require('./routes/emergencyRoutes'));
app.use('/api/trips', require('./routes/tripsRoutes'));
// admin routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/feedbackRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));

let razorpayInstance = null;
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment service is not configured');
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

function validateAmount(amount) {
  return Number.isInteger(amount) && amount >= 100 && amount <= 1000000000;
}

app.post('/api/create-razorpay-order', async (req, res) => {
  try {
    const razorpay = getRazorpay();
    const amount = Number(req.body.amount);
    if (!validateAmount(amount)) {
      return res.status(400).json({ error: 'Invalid amount. Amount must be an integer in paise between 100 and 1000000000.' });
    }
    const options = {
      amount,
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now(),
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    const errorMessage = err.message === 'Payment service is not configured'
      ? err.message
      : (err && err.error && err.error.description) ? err.error.description : err.message || 'Razorpay order creation failed.';
    return res.status(500).json({ error: errorMessage });
  }
});

app.get('/api/get-razorpay-key', (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

app.post('/api/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, email, method } = req.body;
  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await Payment.create({
        sessionId: razorpay_order_id,
        paymentIntent: razorpay_payment_id,
        amount,
        currency: 'INR',
        status: 'paid',
        email: email || 'user@example.com',
        method: method || 'razorpay',
        created: new Date(),
      });
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  } catch (err) {
    console.log('Payment Verification Error:', err);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
});

app.get('/api/payment-status/:sessionId', async (req, res) => {
  try {
    const payment = await Payment.findOne({ sessionId: req.params.sessionId });
    if (!payment) return res.status(404).json({ error: 'Not found' });
    res.json({ status: payment.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

module.exports = app;
