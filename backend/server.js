// server.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import healthRouter from './routes/health.js';
import errorHandler from './middleware/errorHandler.js';
import participantRouter from './routes/participant.js';
import sessionRouter from './routes/session.js';
import leaderboardRouter from './routes/leaderboard.js';
import adminRouter from './routes/admin.js';
import settingsRouter from './routes/settings.js';

dotenv.config();

// Connect to DB (do not block server start if fails; health route will report status)
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRouter);

// Routes
app.use('/api/participants', participantRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);

// Global error handler (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
