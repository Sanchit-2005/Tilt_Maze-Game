// controllers/sessionController.js
import GameSession from '../models/GameSession.js';
import Participant from '../models/Participant.js';
import mongoose from 'mongoose';

// Helper to fetch participant by ID (participantId not ObjectId)
const findParticipantById = async (participantId) => {
  return Participant.findOne({ participantId });
};

// POST /api/sessions/start
export const startSession = async (req, res) => {
  try {
    const { participantId, mode } = req.body; // mode optional
    if (!participantId) {
      return res.status(400).json({ error: 'participantId required' });
    }
    const participant = await findParticipantById(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    const session = new GameSession({
      participant: participant._id,
      mode: mode === 'competition' ? 'competition' : 'practice',
    });
    await session.save();
    res.status(201).json({ sessionId: session.sessionId, mode: session.mode, status: session.status, startTime: session.startTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/sessions/:sessionId
export const getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findOne({ sessionId }).populate('participant', 'participantId displayName');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const data = {
      sessionId: session.sessionId,
      participantId: session.participant?.participantId,
      mode: session.mode,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      score: session.score,
      completionTimeMs: session.completionTimeMs,
      highestLevel: session.highestLevel,
    };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/sessions/:sessionId/complete
export const submitResult = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { participantId, score, completionTimeMs, highestLevel } = req.body;
    if (!participantId) return res.status(400).json({ error: 'participantId required' });
    const session = await GameSession.findOne({ sessionId }).populate('participant');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    // Ensure the session belongs to the participant
    if (session.participant.participantId !== participantId) {
      return res.status(403).json({ error: 'Session does not belong to participant' });
    }
    // Prevent duplicate submissions
    if (session.resultSubmitted) {
      return res.status(409).json({ error: 'Result already submitted for this session' });
    }
    // Update session fields
    session.status = 'completed';
    session.endTime = new Date();
    session.score = score ?? null;
    session.completionTimeMs = completionTimeMs ?? null;
    session.highestLevel = highestLevel ?? null;
    session.resultSubmitted = true;
    await session.save();
    res.json({ message: 'Result recorded', sessionId: session.sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
