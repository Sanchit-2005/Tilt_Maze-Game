// routes/settings.js
import express from 'express';
import GameSettings from '../models/GameSettings.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const settings = await GameSettings.findOne();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json({ status: 'ok', settings, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
