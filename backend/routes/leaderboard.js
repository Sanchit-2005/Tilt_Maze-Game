// routes/leaderboard.js
import express from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

// GET /api/leaderboard?mode=competition&page=1&limit=20
router.get('/', getLeaderboard);

export default router;
