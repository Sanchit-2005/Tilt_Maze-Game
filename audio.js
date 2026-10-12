(() => {
  "use strict";

  const MUSIC_SOURCE = "assets/audio/calm-maze-loop.mp3";
  const MUTED_STORAGE_KEY = "tiltMazeAudioMuted";
  const MUSIC_VOLUME = 0.25;
  const NOOP = () => {};

  let audioContext = null;
  let music = null;
  let musicUnavailable = false;
  let muted = false;
  let initialized = false;
  let musicFadeFrame = null;
  let rolling = null;
  let lastLowTimeSecond = null;
  let toggleButton = null;

  function restoreMutedState() {
    try {
      return localStorage.getItem(MUTED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function saveMutedState() {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
    } catch {
      // Storage can be unavailable in private or restricted browser sessions.
    }
  }

  function syncToggle() {
    if (!toggleButton) return;
    toggleButton.classList.toggle("is-muted", muted);
    toggleButton.setAttribute("aria-pressed", String(muted));
    toggleButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    toggleButton.title = `${muted ? "Unmute" : "Mute"} sound (M)`;
  }

  function getContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      audioContext = new AudioContextClass();
    } catch {
      audioContext = null;
    }

    return audioContext;
  }

  function prepareMusic() {
    if (music || musicUnavailable) return;

    try {
      music = new Audio(MUSIC_SOURCE);
      music.loop = true;
      music.preload = "auto";
      music.volume = 0;
      music.addEventListener("error", () => {
        musicUnavailable = true;
        music = null;
      }, { once: true });
    } catch {
      musicUnavailable = true;
      music = null;
    }
  }

  function fadeMusic(targetVolume, duration, onComplete = NOOP) {
    if (!music) return;
    if (musicFadeFrame !== null) cancelAnimationFrame(musicFadeFrame);

    const startingVolume = music.volume;
    const startedAt = performance.now();

    const frame = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      music.volume = startingVolume + (targetVolume - startingVolume) * progress;

      if (progress < 1) musicFadeFrame = requestAnimationFrame(frame);
      else {
        musicFadeFrame = null;
        onComplete();
      }
    };

    musicFadeFrame = requestAnimationFrame(frame);
  }

  function ensureRolling() {
    const context = getContext();
    if (!context || rolling) return rolling;

    try {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 34;
      filter.type = "lowpass";
      filter.frequency.value = 105;
      gain.gain.value = 0;
      oscillator.connect(filter).connect(gain).connect(context.destination);
      oscillator.start();
      rolling = { oscillator, filter, gain };
    } catch {
      rolling = null;
    }

    return rolling;
  }

  function playTone({ frequency, endFrequency = frequency, duration, volume, type = "sine", delay = 0 }) {
    const context = getContext();
    if (!context || muted || context.state !== "running") return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + delay;
      const endAt = startAt + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.03);
    } catch {
      // Web Audio failures should never affect gameplay.
    }
  }

  function updateRolling(speed = 0) {
    const activeRolling = ensureRolling();
    const context = getContext();
    if (!activeRolling || !context || context.state !== "running") return;

    const normalizedSpeed = Math.max(0, Math.min(1, Number(speed) / 12));
    const volume = muted || normalizedSpeed < 0.06 ? 0 : normalizedSpeed * 0.07;
    activeRolling.oscillator.frequency.setTargetAtTime(32 + normalizedSpeed * 40, context.currentTime, 0.05);
    activeRolling.filter.frequency.setTargetAtTime(92 + normalizedSpeed * 150, context.currentTime, 0.05);
    activeRolling.gain.gain.setTargetAtTime(volume, context.currentTime, 0.06);
  }

  function init() {
    if (!initialized) {
      initialized = true;
      muted = restoreMutedState();
      prepareMusic();
      syncToggle();
    }

    const context = getContext();
    if (context?.state === "suspended") context.resume().catch(NOOP);
  }

  function startMusic(immediate = false) {
    init();
    if (muted || !music || musicUnavailable) return;

    if (musicFadeFrame !== null) {
      cancelAnimationFrame(musicFadeFrame);
      musicFadeFrame = null;
    }
    const playback = music.play();
    if (playback && typeof playback.catch === "function") playback.catch(NOOP);
    if (immediate) music.volume = MUSIC_VOLUME;
    else fadeMusic(MUSIC_VOLUME, 300);
  }

  function stopMusic(immediate = false) {
    if (!music) return;
    if (immediate) {
      if (musicFadeFrame !== null) {
        cancelAnimationFrame(musicFadeFrame);
        musicFadeFrame = null;
      }
      music.volume = 0;
      music.pause();
      return;
    }
    if (music.paused) return;
    fadeMusic(0, 180, () => music?.pause());
  }

  function setMuted(nextMuted, immediate = false) {
    muted = Boolean(nextMuted);
    saveMutedState();
    syncToggle();

    if (muted) {
      updateRolling(0);
      stopMusic(immediate);
    }
  }

  function toggle() {
    init();
    const isPlaying = Boolean(music && !music.paused && !music.ended);
    setMuted(isPlaying, true);
    if (!isPlaying) startMusic(true);
    return muted;
  }

  function playSfx(name, value) {
    if (!initialized) return;

    if (name === "roll") {
      updateRolling(value);
      return;
    }

    if (muted) return;

    if (name === "click") playTone({ frequency: 680, endFrequency: 860, duration: 0.06, volume: 0.035 });
    if (name === "bump") playTone({ frequency: 112, endFrequency: 72, duration: 0.09, volume: 0.06, type: "triangle" });
    if (name === "merge") {
      playTone({ frequency: 280, endFrequency: 420, duration: 0.16, volume: 0.055, type: "sine" });
      playTone({ frequency: 420, endFrequency: 560, duration: 0.14, volume: 0.035, type: "sine", delay: 0.05 });
    }
    if (name === "goal") playTone({ frequency: 520, endFrequency: 780, duration: 0.22, volume: 0.06, type: "sine" });
    if (name === "levelComplete") {
      playTone({ frequency: 523, duration: 0.17, volume: 0.045, delay: 0.02 });
      playTone({ frequency: 659, duration: 0.2, volume: 0.045, delay: 0.11 });
      playTone({ frequency: 784, duration: 0.3, volume: 0.05, delay: 0.22 });
    }
    if (name === "gameOver") playTone({ frequency: 260, endFrequency: 108, duration: 0.34, volume: 0.065, type: "triangle" });
    if (name === "lowTime") {
      const second = Number(value);
      if (second > 0 && second <= 10 && second !== lastLowTimeSecond) {
        lastLowTimeSecond = second;
        playTone({ frequency: 760, endFrequency: 690, duration: 0.055, volume: 0.035, type: "square" });
      }
    }
  }

  function setUpControls() {
    toggleButton = document.getElementById("btn-audio-toggle");
    muted = restoreMutedState();
    syncToggle();

    toggleButton?.addEventListener("click", () => {
      init();
      const isMuted = toggle();
      if (!isMuted) playSfx("click");
    });

    window.addEventListener("pointerdown", init, { once: true, capture: true });
    window.addEventListener("keydown", init, { once: true, capture: true });
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      if (event.key.toLowerCase() !== "m" || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      event.preventDefault();
      init();
      const isMuted = toggle();
      if (!isMuted) playSfx("click");
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("button");
      if (button && button !== toggleButton) playSfx("click");
    });
  }

  window.AudioManager = { init, playSfx, startMusic, stopMusic, setMuted, toggle };
  setUpControls();
})();
