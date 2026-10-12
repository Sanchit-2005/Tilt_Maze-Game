// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Connect to DB (do not block server start if fails; health route will report status)
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Serve only the browser files required by the game and admin page. The
// repository root is deliberately not exposed through express.static.
const publicFiles = new Set([
  'index.html',
  'admin.html',
  'script.js',
  'style.css',
  'intro.js',
  'intro.css',
  'tutorial.js',
  'tutorial.css',
  'audio.js',
  'storage.js',
  'admin.js',
  'admin.css',
]);

const sendPublicFile = (fileName, res, next) => {
  if (!publicFiles.has(fileName)) return next();
  res.sendFile(path.join(repoRoot, fileName), { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) next(err);
  });
};

app.get('/', (req, res, next) => sendPublicFile('index.html', res, next));
app.get('/admin.html', (req, res) => res.redirect(301, '/admin'));
app.get(['/admin', '/admin/'], (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  sendPublicFile('admin.html', res, next);
});
app.get('/index.html', (req, res, next) => sendPublicFile('index.html', res, next));
app.get(
  Array.from(publicFiles).filter((fileName) => !['index.html', 'admin.html'].includes(fileName)).map((fileName) => `/${fileName}`),
  (req, res, next) => sendPublicFile(req.path.slice(1), res, next),
);
app.use('/assets', express.static(path.join(repoRoot, 'assets'), { dotfiles: 'deny', index: false }));

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
