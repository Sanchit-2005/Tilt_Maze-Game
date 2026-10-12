// controllers/leaderboardController.js
import GameSession from '../models/GameSession.js';

// GET /api/leaderboard?mode=competition&page=1&limit=20
export const getLeaderboard = async (req, res) => {
  try {
    const mode = req.query.mode === 'practice' ? 'practice' : 'competition'; // default competition
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Only include completed sessions
    const filter = { mode, status: 'completed' };

    const total = await GameSession.countDocuments(filter);
    const sessions = await GameSession.find(filter)
      .populate('participant', 'participantId displayName')
      .sort({ score: -1, completionTimeMs: 1 }) // higher score, faster time
      .skip(skip)
      .limit(limit)
      .select('-_id sessionId participant score completionTimeMs highestLevel');

    const results = sessions.map((s) => ({
      sessionId: s.sessionId,
      participantId: s.participant?.participantId,
      displayName: s.participant?.displayName,
      score: s.score,
      completionTimeMs: s.completionTimeMs,
      highestLevel: s.highestLevel,
    }));

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
