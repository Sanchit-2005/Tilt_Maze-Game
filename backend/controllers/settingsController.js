// controllers/settingsController.js
import GameSettings from '../models/GameSettings.js';

// GET /api/settings - returns the singleton settings document (creates defaults if none)
export const getSettings = async (req, res) => {
  try {
    let settings = await GameSettings.findOne();
    if (!settings) {
      // create a default document
      settings = new GameSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
