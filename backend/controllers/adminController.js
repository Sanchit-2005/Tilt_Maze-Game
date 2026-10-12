// controllers/adminController.js
import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// POST /api/admin/login
export const adminLogin = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  // Verify MongoDB connection is established
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ MongoDB not connected');
    return res.status(500).json({ error: 'Database not connected' });
  }
  // Normalize email to lower case (schema also lowercases on save)
  email = email.toString().toLowerCase();
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await admin.validatePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
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

// GET /api/admin/participants (protected)
export const listParticipants = async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const filter = search
    ? { $or: [{ participantId: new RegExp(search, 'i') }, { displayName: new RegExp(search, 'i') }] }
    : {};
  try {
    const Participant = (await import('../models/Participant.js')).default;
    const total = await Participant.countDocuments(filter);
    const participants = await Participant.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .select('-_id participantId displayName createdAt');
    res.json({ page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit), participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/sessions (protected)
export const listSessions = async (req, res) => {
  const { mode, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const filter = mode ? { mode } : {};
  try {
    const Session = (await import('../models/GameSession.js')).default;
    const total = await Session.countDocuments(filter);
    const sessions = await Session.find(filter)
      .populate('participant', 'participantId displayName')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-_id sessionId participant mode status startTime endTime score completionTimeMs highestLevel');
    res.json({ page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit), sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/settings (protected)
export const getGameSettings = async (req, res) => {
  try {
    const settings = await (await import('../models/GameSettings.js')).default.findOne();
    if (!settings) return res.status(404).json({ error: 'Settings not found' });
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/admin/settings (protected)
export const updateGameSettings = async (req, res) => {
  const updates = req.body;
  try {
    const Settings = (await import('../models/GameSettings.js')).default;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(updates);
    } else {
      Object.assign(settings, updates);
    }
    await settings.save();
    res.json({ message: 'Settings updated', settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/participants/export (protected, CSV)
export const exportParticipantsCSV = async (req, res) => {
  try {
    const Participant = (await import('../models/Participant.js')).default;
    const participants = await Participant.find().select('-_id participantId displayName createdAt');
    let csv = 'participantId,displayName,createdAt\n';
    participants.forEach(p => {
      csv += `${p.participantId},"${p.displayName || ''}",${p.createdAt.toISOString()}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/sessions/export (protected, CSV)
export const exportSessionsCSV = async (req, res) => {
  try {
    const Session = (await import('../models/GameSession.js')).default;
    const sessions = await Session.find().populate('participant', 'participantId displayName');
    let csv = 'sessionId,participantId,displayName,mode,status,score,completionTimeMs,highestLevel,startTime,endTime\n';
    sessions.forEach(s => {
      const pid = s.participant?.participantId || '';
      const dname = s.participant?.displayName || '';
      csv += `${s.sessionId},${pid},"${dname}",${s.mode},${s.status},${s.score ?? ''},${s.completionTimeMs ?? ''},${s.highestLevel ?? ''},${s.startTime?.toISOString() || ''},${s.endTime?.toISOString() || ''}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sessions.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

