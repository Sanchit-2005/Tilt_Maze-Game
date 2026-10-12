import {
  addScore,
  clearScores,
  deleteScore,
  getScores,
  sanitizeName,
  updateScore,
  validateEntry,
} from "/storage.js";

// Admin credentials are verified by the same-origin backend. The database
// stores a bcrypt hash; the password is never embedded in this client file.
const ADMIN_LOGIN_URL = "/api/admin/login";
const SESSION_KEY = "tiltMazeAdminSession";
const LOGIN_STATE_KEY = "tiltMazeAdminLoginState";
const SESSION_TTL_MS = 30 * 60 * 1000;
const LOCKOUT_MS = 30 * 1000;

let sessionTimer = null;

function $(selector) {
  return document.querySelector(selector);
}

function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function setMessage(text, isError = false) {
  const element = $("#admin-message");
  element.textContent = text;
  element.classList.toggle("hidden", !text);
  element.classList.toggle("error", isError);
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (
      !session ||
      typeof session.token !== "string" ||
      !session.token ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(token) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token, expiresAt: Date.now() + SESSION_TTL_MS }),
    );
    return true;
  } catch {
    return false;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // A failed cleanup should not leave the dashboard visible.
  }
}

function readLoginState() {
  try {
    const raw = sessionStorage.getItem(LOGIN_STATE_KEY);
    const state = raw ? JSON.parse(raw) : {};
    return {
      attempts: Number.isInteger(state.attempts) ? state.attempts : 0,
      lockedUntil: Number.isFinite(state.lockedUntil) ? state.lockedUntil : 0,
    };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function writeLoginState(state) {
  try {
    sessionStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(state));
  } catch {
    // Lockout state is best effort in a browser with blocked storage.
  }
}

function scheduleSessionExpiry(session) {
  window.clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
}

async function login(event) {
  event.preventDefault();
  const errorElement = $("#login-error");
  const state = readLoginState();
  const remainingLock = state.lockedUntil - Date.now();

  if (remainingLock > 0) {
    errorElement.textContent = `Too many attempts. Try again in ${Math.ceil(remainingLock / 1000)}s.`;
    show(errorElement);
    return;
  }

  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;
  try {
    const response = await fetch(ADMIN_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (response.status === 401) {
      const attempts = state.attempts + 1;
      if (attempts >= 5) {
        writeLoginState({ attempts: 0, lockedUntil: Date.now() + LOCKOUT_MS });
        errorElement.textContent = "Too many attempts. Try again in 30s.";
      } else {
        writeLoginState({ attempts, lockedUntil: 0 });
        errorElement.textContent = "Invalid password.";
      }
      show(errorElement);
      return;
    }

    if (!response.ok || typeof payload.token !== "string" || !payload.token) {
      throw new Error(payload.error || "Login failed.");
    }

    const session = { token: payload.token, expiresAt: Date.now() + SESSION_TTL_MS };
    if (!writeSession(payload.token)) throw new Error("Session storage is unavailable.");
    writeLoginState({ attempts: 0, lockedUntil: 0 });
    $("#email").value = "";
    $("#password").value = "";
    hide(errorElement);
    showDashboard(session);
  } catch {
    errorElement.textContent = "Unable to complete login in this browser.";
    show(errorElement);
  }
}

function logout() {
  clearSession();
  window.clearTimeout(sessionTimer);
  sessionTimer = null;
  hide($("#dashboard-view"));
  show($("#login-view"));
  $("#password").focus();
}

async function validateSession(session) {
  const response = await fetch("/api/admin/stats", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.token}`,
    },
  });
  return response.ok;
}

async function initAuth() {
  const session = readSession();
  if (!session) {
    logout();
    return;
  }
  try {
    if (await validateSession(session)) showDashboard(session);
    else logout();
  } catch {
    logout();
  }
}

function loadStats(scores = getScores()) {
  const total = scores.length;
  const highest = total ? Math.max(...scores.map((entry) => entry.score)) : 0;
  const average = total ? scores.reduce((sum, entry) => sum + entry.score, 0) / total : 0;
  $("#total-games").textContent = String(total);
  $("#highest-score").textContent = highest.toLocaleString();
  $("#average-score").textContent = Math.round(average).toLocaleString();
}

function scoreComparator(sortKey) {
  return (a, b) => {
    if (sortKey === "level") return b.level - a.level || b.score - a.score;
    if (sortKey === "time") return a.totalTimeMs - b.totalTimeMs || b.score - a.score;
    if (sortKey === "date") return Date.parse(b.date) - Date.parse(a.date);
    if (sortKey === "name") return a.name.localeCompare(b.name) || b.score - a.score;
    return b.score - a.score || b.level - a.level || a.totalTimeMs - b.totalTimeMs;
  };
}

function formatTime(totalTimeMs) {
  return `${(totalTimeMs / 1000).toFixed(1)}s`;
}

function appendTextCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = String(value);
  row.appendChild(cell);
}

function renderScores() {
  const allScores = getScores();
  const query = $("#score-search").value.trim().toLocaleLowerCase();
  const sortKey = $("#score-sort").value;
  const scores = allScores
    .filter((entry) => !query || entry.name.toLocaleLowerCase().includes(query))
    .sort(scoreComparator(sortKey));
  const tbody = $("#scores-table tbody");
  const empty = $("#scores-empty");
  tbody.replaceChildren();
  empty.classList.toggle("hidden", scores.length > 0);

  scores.forEach((entry, index) => {
    const row = document.createElement("tr");
    appendTextCell(row, index + 1);
    appendTextCell(row, entry.name);
    appendTextCell(row, entry.score.toLocaleString());
    appendTextCell(row, entry.level);
    appendTextCell(row, formatTime(entry.totalTimeMs));
    appendTextCell(row, new Date(entry.date).toLocaleString());

    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "row-actions";
    const editButton = document.createElement("button");
    editButton.className = "btn secondary";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editEntry(entry));
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => removeEntry(entry));
    actionGroup.append(editButton, deleteButton);
    actions.appendChild(actionGroup);
    row.appendChild(actions);
    tbody.appendChild(row);
  });
}

function refreshDashboard() {
  const scores = getScores();
  loadStats(scores);
  renderScores();
}

function editEntry(entry) {
  const proposed = window.prompt("Player name (12 characters maximum)", entry.name);
  if (proposed === null) return;
  const name = sanitizeName(proposed);
  if (!name) {
    setMessage("The player name cannot be empty.", true);
    return;
  }
  try {
    updateScore(entry.id, { name });
    setMessage("Player name updated.");
    refreshDashboard();
  } catch {
    setMessage("Unable to update that score.", true);
  }
}

function removeEntry(entry) {
  if (!window.confirm(`Delete the score for ${entry.name}?`)) return;
  try {
    deleteScore(entry.id);
    setMessage("Score deleted.");
    refreshDashboard();
  } catch {
    setMessage("Unable to delete that score.", true);
  }
}

function clearAllScores() {
  if (!window.confirm("Clear the entire leaderboard? This cannot be undone.")) return;
  if (clearScores()) {
    setMessage("Leaderboard cleared.");
    refreshDashboard();
  } else {
    setMessage("Unable to clear the leaderboard.", true);
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportCSV() {
  const header = ["id", "name", "score", "level", "totalTimeMs", "date"];
  const rows = getScores().sort(scoreComparator("score")).map((entry) => [
    entry.id,
    entry.name,
    entry.score,
    entry.level,
    entry.totalTimeMs,
    entry.date,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`${csv}\r\n`, "tilt-maze-scores.csv", "text/csv;charset=utf-8");
  setMessage("CSV exported.");
}

async function importJSON(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("JSON must contain up to 100 entries.");

    const normalized = parsed.map((entry) => validateEntry(entry, { allowMissingId: true }));
    const ids = new Set();
    normalized.forEach((entry) => {
      if (ids.has(entry.id)) throw new Error("Duplicate score id.");
      ids.add(entry.id);
    });

    if (!clearScores()) throw new Error("Unable to clear existing scores.");
    normalized.forEach((entry) => addScore(entry));
    setMessage(`${normalized.length} score${normalized.length === 1 ? "" : "s"} imported.`);
    refreshDashboard();
  } catch {
    setMessage("Import failed: every entry must be valid score JSON.", true);
  }
}

function showDashboard(session = readSession()) {
  if (!session || session.expiresAt <= Date.now()) {
    logout();
    return;
  }
  hide($("#login-view"));
  show($("#dashboard-view"));
  scheduleSessionExpiry(session);
  try {
    refreshDashboard();
    setMessage("");
  } catch {
    setMessage("Unable to read local scores.", true);
  }
}

$("#login-form").addEventListener("submit", login);
$("#logout-btn").addEventListener("click", logout);
$("#score-search").addEventListener("input", renderScores);
$("#score-sort").addEventListener("change", renderScores);
$("#clear-scores").addEventListener("click", clearAllScores);
$("#export-scores").addEventListener("click", exportCSV);
$("#import-json").addEventListener("change", importJSON);
initAuth();
