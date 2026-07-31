const mongoose = require('mongoose');

const cache = global.mongooseCache || { conn: null, promise: null };
global.mongooseCache = cache;

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI;
}

/** Atlas URIs without a DB name often fail — insert default before query string. */
function normalizeMongoUri(uri) {
  if (!uri) return uri;
  const dbName = process.env.MONGO_DB_NAME || 'tourist_assistant';

  if (/mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri)) {
    return uri;
  }

  const q = uri.indexOf('?');
  if (q === -1) {
    return `${uri.replace(/\/$/, '')}/${dbName}`;
  }
  const base = uri.slice(0, q).replace(/\/$/, '');
  return `${base}/${dbName}${uri.slice(q)}`;
}

async function connectDB() {
  const rawUri = getMongoUri();
  if (!rawUri) {
    throw new Error('MONGO_URI is not set. Add it in Vercel → Settings → Environment Variables.');
  }

  const uri = normalizeMongoUri(rawUri);

  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      })
      .then((m) => {
        cache.conn = m.connection || m;
        console.log('MongoDB connected.');
        
        // Auto-seed destinations
        try {
          const { seedDestinations } = require('./services/seeder');
          seedDestinations();
        } catch (seederErr) {
          console.error('Failed to run automatic seeder:', seederErr.message);
        }
        
        return cache.conn;
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }

  return cache.promise;
}

module.exports = { connectDB, getMongoUri, normalizeMongoUri };
