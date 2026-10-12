// models/GameSession.js
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const gameSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, default: uuidv4, unique: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
    participantName: { type: String, required: true },
    mode: { type: String, enum: ['practice', 'competition'], default: 'practice' },
    status: {
      type: String,
      enum: ['active', 'completed', 'timedout', 'abandoned'],
      default: 'active',
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    score: { type: Number, min: 0 },
    completionTimeMs: { type: Number, min: 0 }, // time taken in ms
    highestLevel: { type: Number, min: 1 },
    // Prevent duplicate submissions: track if result submitted
    resultSubmitted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for fast lookup & leaderboard

gameSessionSchema.index({ mode: 1, score: -1, completionTimeMs: 1 });

export default mongoose.model('GameSession', gameSessionSchema);
