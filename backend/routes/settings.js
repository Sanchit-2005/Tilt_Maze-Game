// routes/settings.js
import express from 'express';

// In a real deployment these would be fetched from a DB or env vars.
// For now we expose a static configuration that matches the existing frontend expectations.
const DEFAULT_SETTINGS = {
  timerSeconds: 120, // default game timer
  difficultyLevels: ['Easy', 'Medium', 'Hard'],
  maxLevel: 10,
  gridSize: { min: 5, max: 12 },
  // Add any additional settings used by the client here.
};

const router = express.Router();

// GET /api/settings – returns the current game configuration
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    settings: DEFAULT_SETTINGS,
    timestamp: new Date().toISOString(),
  });
});

export default router;
