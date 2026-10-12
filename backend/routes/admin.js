// routes/admin.js
import express from 'express';
import {
  adminLogin,
  getAdminStats,
  listParticipants,
  listSessions,
  getGameSettings,
  updateGameSettings,
  exportParticipantsCSV,
  exportSessionsCSV,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public login endpoint
router.post('/login', adminLogin);

// Protected admin routes
router.get('/stats', protect, getAdminStats);
router.get('/participants', protect, listParticipants);
router.get('/sessions', protect, listSessions);
router.get('/settings', protect, getGameSettings);
router.put('/settings', protect, updateGameSettings);
router.get('/participants/export', protect, exportParticipantsCSV);
router.get('/sessions/export', protect, exportSessionsCSV);

export default router;
