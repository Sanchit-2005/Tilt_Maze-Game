// models/Participant.js
import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    participantId: { type: String, required: true, unique: true },
    displayName: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);



export default mongoose.model('Participant', participantSchema);
