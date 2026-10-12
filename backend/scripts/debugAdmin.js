// backend/scripts/debugAdmin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Admin from '../models/Admin.js';

// Resolve __dirname in ES‑module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not defined');
    process.exit(1);
  }
  await mongoose.connect(mongoUri, { dbName: 'tiltmaze' });
  const admins = await Admin.find({}).select('email role createdAt');
  console.log('Admin records:', admins.map(({ email, role, createdAt }) => ({ email, role, createdAt })));
  process.exit(0);
})();
