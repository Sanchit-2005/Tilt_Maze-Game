// routes/participant.js
import express from 'express';
import { registerParticipant, getParticipant } from '../controllers/participantController.js';

const router = express.Router();

// Register a new participant (generates unique participantId)
router.post('/register', registerParticipant);

// Retrieve participant info (public)
router.get('/:id', getParticipant);

export default router;
