// routes/admin.js
import express from 'express';
import { adminLogin, getAdminStats } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public login endpoint
router.post('/login', adminLogin);

// Protected stats endpoint
router.get('/stats', protect, getAdminStats);

export default router;
