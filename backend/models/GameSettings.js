// models/GameSettings.js
import mongoose from 'mongoose';

const gameSettingsSchema = new mongoose.Schema(
  {
    sessionsEnabled: { type: Boolean, default: true }, // allow new sessions
    timerDuration: { type: Number, default: 60 }, // seconds per level base
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    maxLevel: { type: Number, default: 20 },
    gridSize: { type: Number, default: 8 }, // N used in front‑end script
    // Additional settings can be added as needed
  },
  { timestamps: true }
);

// Ensure only a single settings document exists
gameSettingsSchema.index({ _id: 1 }, { unique: true });

export default mongoose.model('GameSettings', gameSettingsSchema);
