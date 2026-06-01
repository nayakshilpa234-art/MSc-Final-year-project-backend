const mongoose = require('mongoose');

let isConnecting = false;

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
    return mongoose.connection;
  }
  isConnecting = true;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected.');
    return mongoose.connection;
  } finally {
    isConnecting = false;
  }
}

module.exports = { connectDB };
