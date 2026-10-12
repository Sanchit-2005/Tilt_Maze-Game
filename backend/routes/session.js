// routes/session.js
import express from 'express';
import {
  startSession,
  getSessionStatus,
  submitResult,
} from '../controllers/sessionController.js';

const router = express.Router();

// Create a new game session (practice or competition)
router.post('/start', startSession);

// Get status of a specific session
router.get('/:sessionId', getSessionStatus);

// Submit final result for a session (once only)
router.post('/:sessionId/complete', submitResult);

export default router;
