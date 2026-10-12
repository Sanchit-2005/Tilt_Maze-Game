// controllers/adminController.js
import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';

// POST /api/admin/login
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await admin.validatePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/stats (protected)
export const getAdminStats = async (req, res) => {
  try {
    const participantCount = await (await import('../models/Participant.js')).default.countDocuments();
    const sessionCount = await (await import('../models/GameSession.js')).default.countDocuments();
    const competitionCount = await (await import('../models/GameSession.js')).default.countDocuments({ mode: 'competition' });
    const practiceCount = await (await import('../models/GameSession.js')).default.countDocuments({ mode: 'practice' });
    res.json({ participantCount, sessionCount, competitionCount, practiceCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
