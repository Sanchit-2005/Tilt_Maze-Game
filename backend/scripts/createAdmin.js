// backend/scripts/createAdmin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const EMAIL = 'admin@test.com';
const PASSWORD = 'Admin123!'; // change if desired

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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
