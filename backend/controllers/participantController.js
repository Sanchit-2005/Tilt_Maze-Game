// controllers/participantController.js
import { v4 as uuidv4 } from 'uuid';
import Participant from '../models/Participant.js';

// Register a new participant and generate a unique participantId
export const registerParticipant = async (req, res) => {
  try {
    const { displayName } = req.body;
    // generate a short unique id (could be UUID or custom)
    const participantId = uuidv4();
    const participant = new Participant({ participantId, displayName });
    await participant.save();
    res.status(201).json({ participantId, displayName: participant.displayName });
  } catch (err) {
    if (err.code === 11000) {
      // duplicate participantId (extremely rare)
      return res.status(409).json({ error: 'Participant ID conflict, try again' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get participant public data by participantId
export const getParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await Participant.findOne({ participantId: id }).select('-_id participantId displayName createdAt');
    if (!participant) return res.status(404).json({ error: 'Participant not found' });
    res.json(participant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
