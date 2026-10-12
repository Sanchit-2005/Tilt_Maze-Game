// config/db.js
import mongoose from 'mongoose';

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 * The function logs the connection status but does not block server startup.
 * If the connection fails, the health endpoint will report "disconnected".
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tiltmaze';
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    // Do not exit; health route will indicate the problem.
  }
};

export default connectDB;
