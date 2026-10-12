(function () {
  "use strict";

  // This file owns a complete, canvas-only demonstration. It never reads or
  // writes the game's maze, balls, timer, input state, or animation frame.
  const steps = [
    {
      title: "Meet the Maze",
      message: "Guide the balls through the maze and collect the targets.",
    },
    {
      title: "Learn the Controls",
      message:
        "Move your mouse over the board, press the Arrow keys, or use the on-screen pad on mobile to tilt and guide the balls.",
    },
    {
      title: "Ball Movement and Merging",
      message:
        "Four orange balls merge when they touch. Their combined size follows the game's area-based merge rule.",
    },
    {
      title: "Navigate the Maze",
      message:
        "Follow open corridors carefully. A ball stops when it meets a wall, so plan your route before tilting.",
    },
    {
      title: "Final Ball and Victory",
      message:
        "Watch the last ball reach the center. Only then is the maze complete.",
    },
  ];

  const overlay = document.getElementById("overlay-tutorial");
  const canvas = document.getElementById("tutorial-canvas");
  const message = document.getElementById("tutorial-message");
  const title = document.getElementById("tutorial-title");
  const indicator = document.getElementById("tutorial-step-indicator");
  const previousButton = document.getElementById("btn-tutorial-prev");
  const nextButton = document.getElementById("btn-tutorial-next");
  const skipButton = document.getElementById("btn-tutorial-skip");
  const startButton = document.getElementById("btn-start-game");

  if (
    !overlay ||
    !canvas ||
    !message ||
    !title ||
    !indicator ||
    !previousButton ||
    !nextButton ||
    !skipButton ||
    !startButton
  ) {
    return;
  }

  const context = canvas.getContext("2d");
  const palette = {
    background: "#f0e9e3",
    wall: "#303128",
    ball: "#f2674f",
    goal: "#7c82c4",
    text: "#26002b",
    sparkle: "#f4b860",
  };
  const board = { left: 60, top: 42, right: 660, bottom: 458 };
  const state = {
    active: false,
    listenersAttached: false,
    step: 0,
    scene: null,
    frameId: null,
    lastTime: 0,
  };

  function ball(x, y, radius = 14) {
    return { x, y, radius, vx: 0, vy: 0, glow: 0 };
  }

  function createScene(step) {
    if (step === 2) {
      return { time: 0, balls: [ball(150, 132, 13), ball(295, 190, 13), ball(488, 128, 13), ball(585, 355, 13)] };
    }
    if (step === 3) {
      return {
        time: 0,
        phase: "pairing",
        phaseTime: 0,
        balls: [ball(150, 135, 12), ball(330, 365, 12), ball(570, 135, 12), ball(390, 365, 12)],
        bursts: [],
      };
    }
    if (step === 4) {
      return {
        time: 0,
        phase: "wall-test",
        pointIndex: 0,
        ball: ball(120, 390, 14),
        collisionFlash: 0,
        completedAt: 0,
        route: [
          { x: 276, y: 390 },
          { x: 250, y: 315 },
          { x: 345, y: 315 },
          { x: 540, y: 315 },
          { x: 540, y: 280 },
          { x: 620, y: 280 },
          { x: 620, y: 145 },
        ],
      };
    }
    if (step === 5) {
      return {
        time: 0,
        phase: "collecting",
        lastRemovalAt: 0,
        pointIndex: 0,
        balls: [ball(150, 130, 13), ball(570, 130, 13), ball(570, 370, 13), ball(120, 390, 14)],
        bursts: [],
        particles: [],
        route: [
          { x: 190, y: 390 },
          { x: 190, y: 255 },
          { x: 360, y: 255 },
          { x: 360, y: 250 },
        ],
      };
    }
    return { time: 0, balls: [ball(150, 130, 13), ball(570, 130, 13), ball(150, 370, 13), ball(570, 370, 13)] };
  }

  function setStep(nextStep) {
    state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
    state.scene = createScene(state.step + 1);
    const current = steps[state.step];
    title.textContent = current.title;
    message.textContent = current.message;
    indicator.textContent = `Step ${state.step + 1} of ${steps.length}`;
    previousButton.disabled = state.step === 0;
    nextButton.classList.toggle("hidden", state.step === steps.length - 1);
    startButton.classList.toggle("hidden", state.step !== steps.length - 1);
  }

  function drawBoardBase() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = palette.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255, 255, 255, 0.25)";
    context.fillRect(board.left, board.top, board.right - board.left, board.bottom - board.top);
  }

  function drawWalls(walls, flashWall) {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 14;
    for (const wall of walls) {
      context.strokeStyle = flashWall && wall === flashWall ? palette.ball : palette.wall;
      context.beginPath();
      context.moveTo(wall[0], wall[1]);
      context.lineTo(wall[2], wall[3]);
      context.stroke();
    }
  }

  function outerWalls() {
    return [
      [board.left, board.top, board.right, board.top],
      [board.right, board.top, board.right, board.bottom],
      [board.right, board.bottom, board.left, board.bottom],
      [board.left, board.bottom, board.left, board.top],
    ];
  }

  function drawGoal(x = 360, y = 250, radius = 42) {
    context.save();
    context.setLineDash([10, 8]);
    context.lineWidth = 5;
    context.strokeStyle = palette.goal;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawBall(item, highlight = false) {
    const glow = highlight ? 0.26 + 0.18 * Math.sin(state.scene.time * 4 + item.x) : 0;
    if (glow > 0) {
      context.beginPath();
      context.fillStyle = `rgba(242, 103, 79, ${glow})`;
      context.arc(item.x, item.y, item.radius + 13, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = palette.ball;
    context.beginPath();
    context.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawBurst(burst) {
    context.strokeStyle = `rgba(242, 103, 79, ${Math.max(0, burst.life)})`;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(burst.x, burst.y, burst.radius + (1 - burst.life) * 38, 0, Math.PI * 2);
    context.stroke();
  }

  function moveTowards(item, target, speed, delta) {
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return true;
    const travel = Math.min(distance, speed * delta);
    item.x += (dx / distance) * travel;
    item.y += (dy / distance) * travel;
    return travel === distance;
  }

  // Mirrors the gameplay's merge formula, but only within tutorial scene data.
  function mergePair(first, second) {
    const massFirst = first.radius * first.radius;
    const massSecond = second.radius * second.radius;
    const massTotal = massFirst + massSecond;
    return {
      x: (first.x * massFirst + second.x * massSecond) / massTotal,
      y: (first.y * massFirst + second.y * massSecond) / massTotal,
      vx: (first.vx * massFirst + second.vx * massSecond) / massTotal,
      vy: (first.vy * massFirst + second.vy * massSecond) / massTotal,
      radius: Math.min(24, Math.sqrt(massTotal)),
      glow: 1,
    };
  }

  function mergeOverlappingBalls(scene) {
    for (let i = 0; i < scene.balls.length; i += 1) {
      for (let j = i + 1; j < scene.balls.length; j += 1) {
        const first = scene.balls[i];
        const second = scene.balls[j];
        if (Math.hypot(first.x - second.x, first.y - second.y) <= first.radius + second.radius) {
          const merged = mergePair(first, second);
          scene.balls.splice(j, 1);
          scene.balls.splice(i, 1, merged);
          scene.bursts.push({ x: merged.x, y: merged.y, radius: merged.radius, life: 1 });
          return true;
        }
      }
    }
    return false;
  }

  function updateMeetMaze(scene, delta) {
    scene.balls.forEach((item, index) => {
      item.x += Math.cos(scene.time * 1.2 + index * 1.9) * 12 * delta;
      item.y += Math.sin(scene.time * 1.4 + index * 2.4) * 12 * delta;
    });
  }

  function updateControls(scene) {
    scene.tilt = Math.sin(scene.time * 1.7) * 0.75;
    scene.ballX = 360 + Math.sin(scene.time * 1.7) * 115;
    scene.ballY = 250 + Math.cos(scene.time * 2.2) * 58;
  }

  function resetMergeScene(scene) {
    scene.time = 0;
    scene.phase = "pairing";
    scene.phaseTime = 0;
    scene.balls = [ball(150, 135, 12), ball(330, 365, 12), ball(570, 135, 12), ball(390, 365, 12)];
    scene.bursts = [];
  }

  function updateMerging(scene, delta) {
    if (scene.phase === "pairing") {
      scene.balls.forEach((item) => {
        const target = item.x < 360 ? { x: 245, y: 250 } : { x: 475, y: 250 };
        moveTowards(item, target, 108, delta);
      });
      mergeOverlappingBalls(scene);
      if (scene.balls.length === 2) {
        scene.phase = "final";
        scene.phaseTime = scene.time;
      }
    } else if (scene.phase === "final") {
      scene.balls.forEach((item) => moveTowards(item, { x: 360, y: 250 }, 75, delta));
      mergeOverlappingBalls(scene);
      if (scene.balls.length === 1) {
        scene.phase = "complete";
        scene.phaseTime = scene.time;
      }
    } else if (scene.time - scene.phaseTime > 2.1) {
      resetMergeScene(scene);
      return;
    }

    scene.bursts.forEach((burst) => { burst.life -= delta * 1.7; });
    scene.bursts = scene.bursts.filter((burst) => burst.life > 0);
  }

  function updateNavigation(scene, delta) {
    if (scene.phase === "wall-test") {
      if (moveTowards(scene.ball, scene.route[0], 130, delta)) {
        scene.phase = "pause-at-wall";
        scene.phaseTime = scene.time;
        scene.collisionFlash = 1;
      }
      return;
    }
    if (scene.phase === "pause-at-wall") {
      scene.collisionFlash = Math.max(0, scene.collisionFlash - delta * 1.7);
      if (scene.time - scene.phaseTime > 0.85) {
        scene.phase = "routing";
        scene.pointIndex = 1;
      }
      return;
    }
    if (scene.phase === "routing") {
      if (moveTowards(scene.ball, scene.route[scene.pointIndex], 145, delta)) {
        scene.pointIndex += 1;
        if (scene.pointIndex === scene.route.length) {
          scene.phase = "complete";
          scene.completedAt = scene.time;
        }
      }
      return;
    }
    if (scene.time - scene.completedAt > 1.25) state.scene = createScene(4);
  }

  function createCelebrationParticles() {
    return Array.from({ length: 52 }, () => ({
      x: 360,
      y: 250,
      vx: (Math.random() - 0.5) * 230,
      vy: -70 - Math.random() * 190,
      size: 4 + Math.random() * 5,
      life: 1,
      color: [palette.ball, palette.goal, palette.sparkle, "#ffffff"][Math.floor(Math.random() * 4)],
    }));
  }

  function updateVictory(scene, delta) {
    if (scene.phase === "collecting") {
      if (scene.balls.length > 1 && scene.time - scene.lastRemovalAt > 0.95) {
        const removed = scene.balls.shift();
        scene.bursts.push({ x: removed.x, y: removed.y, radius: removed.radius, life: 1 });
        scene.lastRemovalAt = scene.time;
      }
      if (scene.balls.length === 1) {
        scene.phase = "final-roll";
        scene.pointIndex = 0;
      }
    } else if (scene.phase === "final-roll") {
      const lastBall = scene.balls[0];
      if (moveTowards(lastBall, scene.route[scene.pointIndex], 135, delta)) {
        scene.pointIndex += 1;
        if (scene.pointIndex === scene.route.length) {
          scene.phase = "victory";
          scene.victoryAt = scene.time;
          scene.particles = createCelebrationParticles();
        }
      }
    }

    scene.bursts.forEach((burst) => { burst.life -= delta * 1.8; });
    scene.bursts = scene.bursts.filter((burst) => burst.life > 0);
    if (scene.phase === "victory") {
      scene.particles.forEach((particle) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 240 * delta;
        particle.life -= delta * 0.32;
      });
      scene.particles = scene.particles.filter((particle) => particle.life > 0);
    }
  }

  function updateScene(delta) {
    const scene = state.scene;
    scene.time += delta;
    if (state.step === 0) updateMeetMaze(scene, delta);
    if (state.step === 1) updateControls(scene);
    if (state.step === 2) updateMerging(scene, delta);
    if (state.step === 3) updateNavigation(scene, delta);
    if (state.step === 4) updateVictory(scene, delta);
  }

  function drawMeetMaze(scene) {
    const walls = outerWalls().concat([
      [180, 42, 180, 210], [180, 210, 330, 210], [330, 210, 330, 110], [420, 42, 420, 150],
      [420, 150, 570, 150], [540, 270, 660, 270], [300, 330, 300, 458], [300, 330, 480, 330], [480, 330, 480, 430],
    ]);
    drawBoardBase();
    drawWalls(walls);
    drawGoal();
    scene.balls.forEach((item) => drawBall(item, true));
    context.fillStyle = palette.text;
    context.font = "700 16px system-ui";
    context.textAlign = "center";
    context.fillText("Orange balls", 360, 485);
  }

  function drawDirectionalArrow(x, y, rotation, active) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.fillStyle = active ? palette.goal : "rgba(124, 130, 196, 0.3)";
    context.beginPath();
    context.moveTo(0, -23); context.lineTo(19, 13); context.lineTo(6, 10); context.lineTo(6, 27);
    context.lineTo(-6, 27); context.lineTo(-6, 10); context.lineTo(-19, 13); context.closePath();
    context.fill();
    context.restore();
  }

  function drawControls(scene) {
    const walls = outerWalls().concat([[170, 110, 300, 110], [300, 110, 300, 200], [420, 300, 550, 300], [420, 300, 420, 390]]);
    drawBoardBase();
    context.save();
    context.translate(360, 250);
    context.rotate(scene.tilt * 0.045);
    context.translate(-360, -250);
    drawWalls(walls);
    drawGoal();
    drawBall({ x: scene.ballX, y: scene.ballY, radius: 14 }, true);
    context.restore();

    const activeDirection = Math.sin(scene.time * 1.7) > 0 ? 1 : -1;
    context.fillStyle = "rgba(240, 233, 227, 0.88)";
    context.beginPath(); context.arc(115, 365, 58, 0, Math.PI * 2); context.fill();
    context.strokeStyle = palette.goal; context.lineWidth = 3; context.stroke();
    drawDirectionalArrow(115, 329, 0, activeDirection < 0);
    drawDirectionalArrow(151, 365, Math.PI / 2, activeDirection > 0);
    drawDirectionalArrow(115, 401, Math.PI, activeDirection > 0);
    drawDirectionalArrow(79, 365, -Math.PI / 2, activeDirection < 0);
    context.fillStyle = palette.text; context.font = "700 14px system-ui"; context.textAlign = "center";
    context.fillText("Tilt", 115, 370);
  }

  function drawMerging(scene) {
    drawBoardBase();
    drawWalls(outerWalls().concat([[360, 75, 360, 145], [360, 355, 360, 425]]));
    drawGoal();
    scene.bursts.forEach(drawBurst);
    scene.balls.forEach((item) => drawBall(item, item.glow > 0));
    context.fillStyle = palette.text; context.font = "700 15px system-ui"; context.textAlign = "center";
    context.fillText(`${scene.balls.length} ball${scene.balls.length === 1 ? "" : "s"} in the demonstration`, 360, 484);
  }

  function drawNavigation(scene) {
    const blocker = [300, 340, 300, 450];
    const walls = outerWalls().concat([[300, 42, 300, 290], blocker, [420, 105, 570, 105], [570, 105, 570, 250], [420, 380, 570, 380]]);
    drawBoardBase();
    drawWalls(walls, scene.collisionFlash > 0 ? blocker : null);
    drawGoal(620, 145, 28);
    context.save();
    context.setLineDash([7, 8]); context.strokeStyle = "rgba(124, 130, 196, 0.75)"; context.lineWidth = 3;
    context.beginPath(); context.moveTo(250, 315); context.lineTo(345, 315); context.lineTo(540, 315); context.lineTo(540, 280); context.lineTo(620, 280); context.lineTo(620, 145); context.stroke();
    context.restore();
    drawBall(scene.ball, scene.collisionFlash > 0);
    if (scene.phase === "pause-at-wall") {
      context.fillStyle = palette.ball; context.font = "700 16px system-ui"; context.textAlign = "center";
      context.fillText("Wall — choose another route", 360, 484);
    }
  }

  function drawVictory(scene) {
    const walls = outerWalls().concat([[110, 80, 270, 80], [450, 80, 610, 80], [490, 300, 610, 300], [110, 420, 275, 420]]);
    drawBoardBase();
    drawWalls(walls);
    drawGoal();
    if (scene.phase === "final-roll" || scene.phase === "victory") {
      context.save();
      context.setLineDash([7, 7]); context.strokeStyle = "rgba(124, 130, 196, 0.7)"; context.lineWidth = 3;
      context.beginPath(); context.moveTo(120, 390); context.lineTo(190, 390); context.lineTo(190, 255); context.lineTo(360, 255); context.lineTo(360, 250); context.stroke();
      context.restore();
    }
    scene.bursts.forEach(drawBurst);
    scene.balls.forEach((item) => drawBall(item, scene.phase === "victory"));
    if (scene.phase === "victory") {
      const pulse = 50 + Math.sin(scene.time * 5) * 7;
      context.beginPath(); context.strokeStyle = "rgba(242, 103, 79, 0.7)"; context.lineWidth = 7; context.arc(360, 250, pulse, 0, Math.PI * 2); context.stroke();
      scene.particles.forEach((particle) => {
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.fillRect(particle.x, particle.y, particle.size, particle.size * 1.5);
      });
      context.globalAlpha = 1;
      context.fillStyle = palette.text; context.font = "900 46px system-ui"; context.textAlign = "center";
      context.fillText("YOU WIN!", 360, 205);
      context.fillStyle = palette.goal; context.font = "800 24px system-ui";
      context.fillText("Ready to play?", 360, 292);
    }
  }

  function drawScene() {
    if (state.step === 0) drawMeetMaze(state.scene);
    if (state.step === 1) drawControls(state.scene);
    if (state.step === 2) drawMerging(state.scene);
    if (state.step === 3) drawNavigation(state.scene);
    if (state.step === 4) drawVictory(state.scene);
  }

  function tick(timestamp) {
    if (!state.active) return;
    const delta = Math.min(0.05, (timestamp - state.lastTime) / 1000 || 0);
    state.lastTime = timestamp;
    updateScene(delta);
    drawScene();
    state.frameId = requestAnimationFrame(tick);
  }

  function stopAnimation() {
    if (state.frameId !== null) {
      cancelAnimationFrame(state.frameId);
      state.frameId = null;
    }
  }

  function startAnimation() {
    stopAnimation();
    state.lastTime = performance.now();
    state.frameId = requestAnimationFrame(tick);
  }

  function previous() { setStep(state.step - 1); }
  function next() { setStep(state.step + 1); }

  function closeAndStartGame() {
    stopAnimation();
    detachListeners();
    state.active = false;
    overlay.classList.add("hidden");
    if (typeof window.startGame === "function") window.startGame();
  }

  const handlers = { previous, next, closeAndStartGame };

  function attachListeners() {
    if (state.listenersAttached) return;
    previousButton.addEventListener("click", handlers.previous);
    nextButton.addEventListener("click", handlers.next);
    skipButton.addEventListener("click", handlers.closeAndStartGame);
    startButton.addEventListener("click", handlers.closeAndStartGame);
    state.listenersAttached = true;
  }

  function detachListeners() {
    if (!state.listenersAttached) return;
    previousButton.removeEventListener("click", handlers.previous);
    nextButton.removeEventListener("click", handlers.next);
    skipButton.removeEventListener("click", handlers.closeAndStartGame);
    startButton.removeEventListener("click", handlers.closeAndStartGame);
    state.listenersAttached = false;
  }

  function show() {
    state.active = true;
    attachListeners();
    setStep(0);
    overlay.classList.remove("hidden");
    startAnimation();
  }

  window.TiltMazeTutorial = { show, closeAndStartGame };
})();
