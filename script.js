// ── Constants & Configuration ───────────────────────────────────────────
const N = 8,
  S = 900,
  PAD = 40,
  C = (S - PAD * 2) / N,
  LW = 16,
  BASE_R = 12,
  MAX_R = 24;
const BASE_TIME = 60,
  TIME_STEP = 5,
  MIN_TIME = 30;
const INITIAL_BALL_COUNT = 4;
const ACCEL = 0.75,
  MAX_TILT = 7,
  DEAD_ZONE = 0.05,
  MAX_SPEED = 12;

// ── DOM refs ────────────────────────────────────────────────────────────
const stage = document.getElementById("stage");
const playerNameInput = document.getElementById("player-name");
const nameError = document.getElementById("name-error");
const cv = document.getElementById("maze"),
  ctx = cv.getContext("2d"),
  nub = document.getElementById("nub");
const hudEl = document.getElementById("hud"),
  hudLevel = document.getElementById("hud-level"),
  hudTimer = document.getElementById("hud-timer"),
  hudBalls = document.getElementById("hud-balls");
const overlayStart = document.getElementById("overlay-start"),
  overlayPause = document.getElementById("overlay-pause"),
  overlayResult = document.getElementById("overlay-result");
const btnPlay = document.getElementById("btn-play"),
  btnPause = document.getElementById("btn-pause"),
  btnResume = document.getElementById("btn-resume"),
  btnRestart = document.getElementById("btn-restart"),
  btnNext = document.getElementById("btn-next"),
  btnRetry = document.getElementById("btn-retry");
const resBadge = document.getElementById("result-badge"),
  resTitle = document.getElementById("result-title"),
  resTime = document.getElementById("res-time"),
  resBalls = document.getElementById("res-balls");

// ── Colour cache ─────────────────────────────────────────────────────────
const col = {
  wall: "",
  wallShadow: "",
  ball: "",
  ballHighlight: "",
  ballShade: "",
  dot: "",
  goal: "",
  goalFill: "",
  bg: "",
};
function refreshColors() {
  const s = getComputedStyle(document.documentElement);
  col.wall = s.getPropertyValue("--wall").trim();
  col.wallShadow = s.getPropertyValue("--wall-shadow").trim();
  col.ball = s.getPropertyValue("--ball").trim();
  col.ballHighlight = s.getPropertyValue("--ball-highlight").trim();
  col.ballShade = s.getPropertyValue("--ball-shade").trim();
  col.dot = s.getPropertyValue("--dot").trim();
  col.goal = s.getPropertyValue("--goal").trim();
  col.goalFill = s.getPropertyValue("--goal-fill").trim();
  col.bg = s.getPropertyValue("--bg").trim();
}
refreshColors();
if (window.matchMedia)
  window
    .matchMedia("(prefers-color-scheme:dark)")
    .addEventListener("change", refreshColors);

// ── Game state ──────────────────────────────────────────────────────────
let gameState = "start",
  level = 1;
let walls = [],
  balls = [],
  mergeEffects = [],
  timeLimit = 60;
const keys = {};
const cursorTilt = { x: 0, y: 0, active: false };

// Timer & Frame-rate independent physics time-step
let timerSnapshot = 0,
  timerStart = 0,
  timeLeft = 0;
let rafId = null;
let tx = 0,
  ty = 0;
let lastFrameTime = performance.now();
const FIXED_STEP = 1000 / 60; // 60 updates/sec regardless of display refresh rate
let accumulator = 0;

// ── Timer helpers ───────────────────────────────────────────────────────
function timeLimitForLevel(lvl) {
  return Math.max(MIN_TIME, BASE_TIME - (lvl - 1) * TIME_STEP);
}
function elapsedMs() {
  return gameState !== "playing"
    ? timerSnapshot
    : timerSnapshot + (performance.now() - timerStart);
}
function startTimer() {
  timerSnapshot = 0;
  timerStart = performance.now();
}
function pauseTimer() {
  timerSnapshot = elapsedMs();
}
function resumeTimer() {
  timerStart = performance.now();
}

// ── Maze generation & 4 orange balls spawn ──────────────────────────────
function buildMaze() {
  const cells = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ t: 1, r: 1, b: 1, l: 1, v: 0 })),
  );
  const stack = [[0, 0]];
  cells[0][0].v = 1;
  const dirs = [
    [0, -1, "t", "b"],
    [1, 0, "r", "l"],
    [0, 1, "b", "t"],
    [-1, 0, "l", "r"],
  ];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = dirs.filter(
      ([dx, dy]) => cells[y + dy]?.[x + dx] && !cells[y + dy][x + dx].v,
    );
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [dx, dy, a, b] = opts[Math.floor(Math.random() * opts.length)];
    cells[y][x][a] = 0;
    cells[y + dy][x + dx][b] = 0;
    cells[y + dy][x + dx].v = 1;
    stack.push([x + dx, y + dy]);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(Math.random() * (N - 1)),
      y = Math.floor(Math.random() * N);
    cells[y][x].r = 0;
    cells[y][x + 1].l = 0;
  }
  walls = [];
  const P = (x, y) => [PAD + x * C, PAD + y * C];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = cells[y][x];
      if (c.t) walls.push([...P(x, y), ...P(x + 1, y)]);
      if (c.l) walls.push([...P(x, y), ...P(x, y + 1)]);
      if (y === N - 1 && c.b) walls.push([...P(x, y + 1), ...P(x + 1, y + 1)]);
      if (x === N - 1 && c.r) walls.push([...P(x + 1, y), ...P(x + 1, y + 1)]);
    }

  // Spawn 4 orange balls in distinct quadrants (avoiding 2x2 center goal)
  const mid = N / 2;
  const quads = [[], [], [], []];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (x >= mid - 1 && x <= mid && y >= mid - 1 && y <= mid) continue;
      const q = (y < mid ? 0 : 2) + (x < mid ? 0 : 1);
      quads[q].push([x, y]);
    }

  balls = [];
  for (let q = 0; q < INITIAL_BALL_COUNT; q++) {
    const list = quads[q];
    const [cx, cy] = list[Math.floor(Math.random() * list.length)];
    balls.push({
      x: PAD + (cx + 0.5) * C,
      y: PAD + (cy + 0.5) * C,
      vx: 0,
      vy: 0,
      r: BASE_R,
    });
  }
  mergeEffects = [];
  timeLimit = timeLimitForLevel(level);
  timeLeft = timeLimit;
}

// ── Collision detection per ball ─────────────────────────────────────────
function collideBall(b) {
  const min = b.r + LW / 2;
  for (const [x1, y1, x2, y2] of walls) {
    const dx = x2 - x1,
      dy = y2 - y1,
      len2 = dx * dx + dy * dy;
    let t = ((b.x - x1) * dx + (b.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx,
      py = y1 + t * dy;
    let ex = b.x - px,
      ey = b.y - py;
    const d = Math.hypot(ex, ey);
    if (d < min) {
      if (d === 0) {
        ex = 1;
        ey = 0;
      } else {
        ex /= d;
        ey /= d;
      }
      b.x = px + ex * min;
      b.y = py + ey * min;
      const vn = b.vx * ex + b.vy * ey;
      if (vn < 0) {
        // Smoothly cancel normal penetration velocity so ball glides freely along walls and corners
        b.vx -= vn * ex;
        b.vy -= vn * ey;
      }
    }
  }
  const lo = PAD - LW / 2 + b.r,
    hi = S - PAD + LW / 2 - b.r;
  if (b.x < lo) {
    b.x = lo;
    if (b.vx < 0) b.vx = 0;
  }
  if (b.x > hi) {
    b.x = hi;
    if (b.vx > 0) b.vx = 0;
  }
  if (b.y < lo) {
    b.y = lo;
    if (b.vy < 0) b.vy = 0;
  }
  if (b.y > hi) {
    b.y = hi;
    if (b.vy > 0) b.vy = 0;
  }
}

// ── Ball merging logic ──────────────────────────────────────────────────
function processMerges() {
  let merged = true;
  while (merged && balls.length > 1) {
    merged = false;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const b1 = balls[i],
          b2 = balls[j];
        const dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
        if (dist <= b1.r + b2.r) {
          const m1 = b1.r * b1.r,
            m2 = b2.r * b2.r,
            mTot = m1 + m2;
          const nx = (b1.x * m1 + b2.x * m2) / mTot;
          const ny = (b1.y * m1 + b2.y * m2) / mTot;
          const nvx = (b1.vx * m1 + b2.vx * m2) / mTot;
          const nvy = (b1.vy * m1 + b2.vy * m2) / mTot;
          const nr = Math.min(MAX_R, Math.round(Math.sqrt(mTot) * 100) / 100);
          const nb = { x: nx, y: ny, vx: nvx, vy: nvy, r: nr };
          collideBall(nb);
          mergeEffects.push({
            x: nb.x,
            y: nb.y,
            r: nr,
            maxR: nr * 2.2,
            life: 1,
          });
          balls.splice(j, 1);
          balls.splice(i, 1, nb);
          merged = true;
          updateHud();
          break;
        }
      }
      if (merged) break;
    }
  }
}

// ── Physics update tick (fixed 60Hz step) ────────────────────────────────
function physicsTick() {
  // Input acceleration (cursor tilt + keyboard / D-pad fallback)
  let ax = cursorTilt.active ? cursorTilt.x * ACCEL : 0;
  let ay = cursorTilt.active ? cursorTilt.y * ACCEL : 0;
  if (keys.ArrowLeft) ax -= ACCEL;
  if (keys.ArrowRight) ax += ACCEL;
  if (keys.ArrowUp) ay -= ACCEL;
  if (keys.ArrowDown) ay += ACCEL;

  // Natural momentum & acceleration
  for (const b of balls) {
    b.vx += ax;
    b.vy += ay;
    b.vx *= 0.92; // Natural friction
    b.vy *= 0.92;
    const spd = Math.hypot(b.vx, b.vy);
    if (spd > MAX_SPEED) {
      b.vx = (b.vx / spd) * MAX_SPEED;
      b.vy = (b.vy / spd) * MAX_SPEED;
    }
  }

  const sub = 3;
  for (let i = 0; i < sub; i++) {
    for (const b of balls) {
      b.x += b.vx / sub;
      b.y += b.vy / sub;
      collideBall(b);
    }
    processMerges();
  }
}

// ── Visual tilt & analog nub synchronization ────────────────────────────
function updateVisualTilt() {
  const avgVx = balls.reduce((s, b) => s + b.vx, 0) / (balls.length || 1);
  const avgVy = balls.reduce((s, b) => s + b.vy, 0) / (balls.length || 1);
  let targetTx = 0,
    targetTy = 0;
  if (cursorTilt.active) {
    targetTx = cursorTilt.y * MAX_TILT;
    targetTy = -cursorTilt.x * MAX_TILT;
  } else {
    targetTx = Math.max(-MAX_TILT, Math.min(MAX_TILT, avgVy * 1.5));
    targetTy = Math.max(-MAX_TILT, Math.min(MAX_TILT, -avgVx * 1.5));
  }
  // Fast, responsive interpolation without sluggish lag
  tx += (targetTx - tx) * 0.25;
  ty += (targetTy - ty) * 0.25;
  cv.style.transform = `rotateX(${4 - tx}deg) rotateY(${-2 + -ty}deg) rotateZ(-0.5deg)`;

  const nubX = cursorTilt.active ? cursorTilt.x * 20 : avgVx * 2;
  const nubY = cursorTilt.active ? cursorTilt.y * 20 : avgVy * 2;
  nub.style.transform = `translate(${20 + Math.max(-20, Math.min(20, nubX))}px,${20 + Math.max(-20, Math.min(20, nubY))}px)`;
}

// ── Main game loop ───────────────────────────────────────────────────────
function step(now = performance.now()) {
  if (gameState === "playing") {
    // Timer tick
    timeLeft = Math.max(0, timeLimit - elapsedMs() / 1000);
    updateHud();

    // Timeout check
    if (timeLeft <= 0) {
      for (const b of balls) {
        b.vx = 0;
        b.vy = 0;
      }
      triggerTimeout();
      draw();
      return;
    }

    // Refresh-rate-independent physics accumulator
    const dt = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;
    accumulator += dt;

    while (accumulator >= FIXED_STEP) {
      physicsTick();
      accumulator -= FIXED_STEP;
    }

    // Goal: all balls must merge into one, then reach the center circle
    if (balls.length === 1) {
      const b = balls[0];
      if (Math.hypot(b.x - S / 2, b.y - S / 2) < C * 0.6) {
        b.vx = 0;
        b.vy = 0;
        triggerWin();
        draw();
        return;
      }
    }

    // Synchronize visual board tilt
    updateVisualTilt();
  } else {
    lastFrameTime = now;
    accumulator = 0;
  }

  draw();
  rafId = requestAnimationFrame(step);
}

// ── Drawing ─────────────────────────────────────────────────────────────
function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function draw() {
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = LW - 3;
  ctx.strokeStyle = col.wall;
  ctx.shadowColor = col.wallShadow;
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  walls.forEach((w) => line(...w));
  ctx.restore();

  const goalPulse = 1 + Math.sin(performance.now() * 0.004) * 0.045;
  ctx.save();
  ctx.setLineDash([22, 18]);
  ctx.lineWidth = 6;
  ctx.strokeStyle = col.goal;
  ctx.fillStyle = col.goalFill;
  ctx.shadowColor = col.goal;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, C * 0.6 * goalPulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Merge ripple effects
  for (let i = mergeEffects.length - 1; i >= 0; i--) {
    const ef = mergeEffects[i];
    ctx.save();
    ctx.beginPath();
    const curR = ef.r + (ef.maxR - ef.r) * (1 - ef.life);
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.strokeStyle = col.dot;
    ctx.lineWidth = 4 * ef.life;
    ctx.globalAlpha = ef.life * 0.85;
    ctx.shadowColor = col.dot;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
    ef.life -= 0.06;
    if (ef.life <= 0) mergeEffects.splice(i, 1);
  }

  // Active orange balls use a visual-only radial gradient for depth.
  for (const b of balls) {
    const gradient = ctx.createRadialGradient(
      b.x - b.r * 0.36,
      b.y - b.r * 0.42,
      Math.max(1, b.r * 0.08),
      b.x,
      b.y,
      b.r,
    );
    gradient.addColorStop(0, col.ballHighlight);
    gradient.addColorStop(0.36, col.ball);
    gradient.addColorStop(1, col.ballShade);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(125, 48, 39, 0.35)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── HUD ─────────────────────────────────────────────────────────────────
function updateHud() {
  hudLevel.textContent = level;
  hudBalls.textContent = balls.length;
  hudTimer.textContent = Math.ceil(timeLeft);
  hudTimer.classList.toggle("warning", timeLeft > 0 && timeLeft <= 10);
}

// ── Overlay / loop helpers ───────────────────────────────────────────────
const showOverlay = (el) => el.classList.remove("hidden");
const hideOverlay = (el) => el.classList.add("hidden");
const showHud = () => hudEl.classList.remove("hud-hidden");
function ensureLoop() {
  if (rafId === null) {
    lastFrameTime = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(step);
  }
}
function cancelLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
function resetCursorTilt() {
  cursorTilt.x = 0;
  cursorTilt.y = 0;
  cursorTilt.active = false;
}

// ── State transitions ────────────────────────────────────────────────────
function startGame() {
  level = 1;
  resetCursorTilt();
  buildMaze();
  hideOverlay(overlayStart);
  showHud();
  updateHud();
  gameState = "playing";
  startTimer();
  lastFrameTime = performance.now();
  accumulator = 0;
  ensureLoop();
}

function pauseGame() {
  if (gameState !== "playing") return;
  resetCursorTilt();
  pauseTimer();
  gameState = "paused";
  cancelLoop();
  showOverlay(overlayPause);
}

function resumeGame() {
  if (gameState !== "paused") return;
  resetCursorTilt();
  hideOverlay(overlayPause);
  gameState = "playing";
  resumeTimer();
  lastFrameTime = performance.now();
  accumulator = 0;
  ensureLoop();
}

function restartLevel() {
  cancelLoop();
  resetCursorTilt();
  hideOverlay(overlayPause);
  hideOverlay(overlayResult);
  tx = 0;
  ty = 0;
  cv.style.transform = "rotateX(4deg) rotateY(-2deg) rotateZ(-0.5deg)";
  buildMaze();
  updateHud();
  gameState = "playing";
  startTimer();
  lastFrameTime = performance.now();
  accumulator = 0;
  ensureLoop();
}

function triggerWin() {
  pauseTimer();
  gameState = "won";
  resetCursorTilt();
  cancelLoop();
  resBadge.className = "badge ok";
  resBadge.textContent = "✓ Level Complete";
  resTitle.textContent = `Level ${level} Clear!`;
  resTime.textContent = formatTime(timerSnapshot);
  resBalls.textContent = balls.length;
  btnNext.style.display = "";
  btnRetry.style.display = "none";
  showOverlay(overlayResult);
}

function triggerTimeout() {
  gameState = "timeout";
  resetCursorTilt();
  cancelLoop();
  resBadge.className = "badge bad";
  resBadge.textContent = "✕ Time’s Up";
  resTitle.textContent = `Level ${level}`;
  resTime.textContent = formatTime(timeLimit * 1000);
  resBalls.textContent = balls.length;
  btnNext.style.display = "none";
  btnRetry.style.display = "";
  showOverlay(overlayResult);
}

function nextLevel() {
  level++;
  resetCursorTilt();
  hideOverlay(overlayResult);
  tx = 0;
  ty = 0;
  cv.style.transform = "rotateX(4deg) rotateY(-2deg) rotateZ(-0.5deg)";
  buildMaze();
  updateHud();
  gameState = "playing";
  startTimer();
  lastFrameTime = performance.now();
  accumulator = 0;
  ensureLoop();
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000),
    dec = Math.floor((ms % 1000) / 100);
  return `${s}.${dec}s`;
}

// ── Continuous cursor tilt control (tracked on stable stage viewport) ───
function handlePointer(e) {
  if (gameState !== "playing") return;
  const rect = stage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let nx = (e.clientX - cx) / (rect.width / 2);
  let ny = (e.clientY - cy) / (rect.height / 2);
  nx = Math.max(-1, Math.min(1, nx));
  ny = Math.max(-1, Math.min(1, ny));
  const dist = Math.hypot(nx, ny);
  if (dist < DEAD_ZONE) {
    cursorTilt.x = 0;
    cursorTilt.y = 0;
  } else {
    const scale = Math.min(1, (dist - DEAD_ZONE) / (1 - DEAD_ZONE));
    cursorTilt.x = (nx / dist) * scale;
    cursorTilt.y = (ny / dist) * scale;
  }
  cursorTilt.active = true;
}

stage.addEventListener("pointermove", handlePointer);
cv.addEventListener("pointermove", handlePointer);
stage.addEventListener("pointerleave", resetCursorTilt);
stage.addEventListener("pointercancel", resetCursorTilt);

// ── Visibility / focus ──────────────────────────────────────────────────
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resetCursorTilt();
    if (gameState === "playing") pauseGame();
    else cancelLoop();
  } else {
    for (const k in keys) delete keys[k];
    if (gameState === "start" || gameState === "playing") {
      lastFrameTime = performance.now();
      accumulator = 0;
      ensureLoop();
    }
  }
});
window.addEventListener("blur", () => {
  resetCursorTilt();
  for (const k in keys) delete keys[k];
});

// ── Keyboard & D-pad Input ───────────────────────────────────────────────
addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "p" || e.key === "P") {
    if (gameState === "playing") pauseGame();
    else if (gameState === "paused") resumeGame();
    e.preventDefault();
    return;
  }
  if (e.key.startsWith("Arrow")) {
    keys[e.key] = true;
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  if (e.key.startsWith("Arrow")) keys[e.key] = false;
});
document.querySelectorAll(".pad button").forEach((b) => {
  const k = b.dataset.k;
  b.addEventListener("pointerdown", (e) => {
    keys[k] = true;
    e.preventDefault();
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    b.addEventListener(ev, () => (keys[k] = false)),
  );
});

// ── Button wiring ────────────────────────────────────────────────────────
function handleNameSubmit() {
  const name = playerNameInput.value.trim();

  if (!name) {
    nameError.textContent = "Please enter your name.";
    nameError.classList.remove("hidden");
    return;
  }

  nameError.textContent = "";
  nameError.classList.add("hidden");
  localStorage.setItem("tiltMazePlayerName", name);
  cancelLoop();
  if (window.TiltMazeTutorial && typeof window.TiltMazeTutorial.show === "function") {
    window.TiltMazeTutorial.show();
  } else {
    startGame();
  }
}

btnPlay.addEventListener("click", handleNameSubmit);
btnPause.addEventListener("click", pauseGame);
btnResume.addEventListener("click", resumeGame);
btnRestart.addEventListener("click", restartLevel);
btnNext.addEventListener("click", nextLevel);
btnRetry.addEventListener("click", restartLevel);

// ── Boot ─────────────────────────────────────────────────────────────────
function bootGame() {
  buildMaze();
  cv.style.transform = "rotateX(4deg) rotateY(-2deg) rotateZ(-0.5deg)";
  ensureLoop();
  window.startGame = startGame;
}

if (document.getElementById("intro-splash")) {
  window.addEventListener("tiltmaze:introcomplete", bootGame, { once: true });
} else {
  bootGame();
}
