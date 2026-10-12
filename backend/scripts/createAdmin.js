// backend/scripts/createAdmin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Admin from '../models/Admin.js';

// Resolve __dirname in ES‑module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env located in the backend root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const run = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not defined in environment');
      process.exit(1);
    }
    if (!EMAIL || !PASSWORD) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be defined in the environment');
      process.exit(1);
    }
    // Connect using the same options as the backend (no extra flags needed)
    await mongoose.connect(mongoUri, { dbName: 'tiltmaze' });
    // Check if admin already exists
    const existing = await Admin.findOne({ email: EMAIL });
    if (existing) {
      console.log('Admin already exists with this email');
      process.exit(0);
    }
    const admin = new Admin({ email: EMAIL, role: 'admin' });
    await admin.setPassword(PASSWORD);
    await admin.save();
    console.log('Admin account created');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

run();
