// Shared localStorage data layer for the game and the admin page.
//
// localStorage is not a trust boundary: players can edit it, replace this
// JavaScript, or call these functions from the console. Use a server-side
// store and server validation when score integrity or access control matters.

const SCORE_STORAGE_KEY = "tiltMazeScores";
const MAX_ENTRIES = 100;
const MAX_NAME_LENGTH = 12;
const MAX_SCORE = 1_000_000_000;
const MAX_LEVEL = 100_000;
const MAX_TIME_MS = 7 * 24 * 60 * 60 * 1000;

function sanitizeName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateEntry(entry, { allowMissingId = false } = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Score entry must be an object.");
  }

  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : "";
  const rawName = typeof entry.name === "string"
    ? entry.name
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[<>]/g, "")
      .trim()
    : "";
  const name = sanitizeName(rawName);
  const score = entry.score;
  const level = entry.level;
  const totalTimeMs = entry.totalTimeMs;
  const date = entry.date;

  if ((!allowMissingId && !id) || (id && id.length > 120)) {
    throw new TypeError("Score entry id is invalid.");
  }
  if (!rawName || rawName.length > MAX_NAME_LENGTH) {
    throw new TypeError("Score entry name is invalid.");
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new TypeError("Score entry score is invalid.");
  }
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new TypeError("Score entry level is invalid.");
  }
  if (!Number.isFinite(totalTimeMs) || totalTimeMs < 0 || totalTimeMs > MAX_TIME_MS) {
    throw new TypeError("Score entry time is invalid.");
  }
  if (!isValidDate(date)) {
    throw new TypeError("Score entry date is invalid.");
  }

  return {
    id: id || makeId(),
    name,
    score,
    level,
    totalTimeMs: Math.round(totalTimeMs),
    date: new Date(date).toISOString(),
  };
}

function readScores() {
  try {
    const raw = localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const valid = [];
    for (const item of parsed) {
      try {
        valid.push(validateEntry(item));
      } catch {
        // Ignore malformed entries while preserving usable records.
      }
    }
    return valid.slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeScores(scores) {
  try {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scores.slice(-MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

export function getScores() {
  return readScores();
}

export function addScore(entry) {
  const normalized = validateEntry(entry, { allowMissingId: true });
  const scores = readScores();
  scores.push(normalized);
  if (!writeScores(scores)) throw new Error("Unable to save score.");
  return normalized;
}

export function deleteScore(id) {
  if (typeof id !== "string" || !id.trim()) return false;
  const scores = readScores();
  const next = scores.filter((entry) => entry.id !== id);
  if (next.length === scores.length) return false;
  if (!writeScores(next)) throw new Error("Unable to delete score.");
  return true;
}

export function updateScore(id, changes) {
  if (typeof id !== "string" || !id.trim() || !changes || typeof changes !== "object") {
    throw new TypeError("Invalid score update.");
  }
  const scores = readScores();
  const index = scores.findIndex((entry) => entry.id === id);
  if (index < 0) return null;

  const allowed = {};
  for (const key of ["name", "score", "level", "totalTimeMs", "date"]) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) allowed[key] = changes[key];
  }
  const normalized = validateEntry({ ...scores[index], ...allowed });
  scores[index] = normalized;
  if (!writeScores(scores)) throw new Error("Unable to update score.");
  return normalized;
}

export function clearScores() {
  try {
    localStorage.removeItem(SCORE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export { sanitizeName, validateEntry };

// script.js is intentionally kept as a classic script to preserve the game’s
// existing boot order. Expose the same module API for its small score hooks.
// The guard also lets Node-based validation scripts import this module safely.
if (typeof window !== "undefined") {
  window.TiltMazeStorage = {
    getScores,
    addScore,
    deleteScore,
    updateScore,
    clearScores,
    sanitizeName,
    validateEntry,
  };
}
