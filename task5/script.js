const NOTE_FREQUENCIES = [261.63, 329.63, 392.0, 493.88]; // C4, E4, G4, B4 (джазовый мажорный септ-аккорд)
const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"];
const LIGHT_DURATION_MS = 480;
const STEP_GAP_MS = 240;
const ROUND_START_DELAY_MS = 650;

const state = {
  sequence: [],
  playerIndex: 0,
  phase: "idle", // "idle" | "showing" | "input" | "gameover"
  round: 0,
  runId: 0,
  soundEnabled: true
};

let activeTimers = [];
let audioCtx = null;

const statusLineEl = document.getElementById("status-line");
const roundDisplayEl = document.getElementById("round-display");
const stepDisplayEl = document.getElementById("step-display");
const startBtnEl = document.getElementById("start-btn");
const soundBtnEl = document.getElementById("sound-btn");
const vinylDeckEl = document.querySelector(".vinyl-deck");
const vinylDiscEl = document.querySelector(".vinyl-disc");
const notesLayerEl = document.getElementById("notes-layer");
const padButtons = Array.from(document.querySelectorAll(".pad"));

function scheduleTimer(fn, delayMs, runId) {
  const timerId = window.setTimeout(() => {
    activeTimers = activeTimers.filter((id) => id !== timerId);
    if (runId !== state.runId) return;
    fn();
  }, delayMs);
  activeTimers.push(timerId);
  return timerId;
}

function clearAllTimers() {
  for (const timerId of activeTimers) {
    window.clearTimeout(timerId);
  }
  activeTimers = [];
}

function playTone(padIndex) {
  if (!state.soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(NOTE_FREQUENCIES[padIndex] || 440, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Звук не должен ломать игру
  }
}

function spawnFloatingNote(padIndex) {
  const noteEl = document.createElement("span");
  noteEl.className = "floating-note";
  noteEl.textContent = NOTE_GLYPHS[padIndex % NOTE_GLYPHS.length];

  const leftPercent = 18 + padIndex * 20 + (Math.random() * 8 - 4);
  noteEl.style.left = `${leftPercent}%`;

  notesLayerEl.appendChild(noteEl);
  window.setTimeout(() => {
    noteEl.remove();
  }, 1200);
}

function flashPad(padIndex, runId, durationMs = LIGHT_DURATION_MS) {
  const padEl = padButtons[padIndex];
  if (!padEl) return;

  padEl.classList.add("active");
  playTone(padIndex);
  spawnFloatingNote(padIndex);

  scheduleTimer(() => {
    padEl.classList.remove("active");
  }, durationMs, runId);
}

function render() {
  roundDisplayEl.textContent = String(state.round);

  const totalSteps = state.sequence.length;
  const currentStep = state.phase === "input" ? state.playerIndex + 1 : 0;
  stepDisplayEl.textContent = totalSteps > 0 ? `${currentStep} / ${totalSteps}` : "0 / 0";

  const canPlayerClick = state.phase === "input";
  for (const padEl of padButtons) {
    padEl.disabled = !canPlayerClick;
  }

  statusLineEl.classList.remove("is-repeat", "is-error");
  if (state.phase === "showing") {
    statusLineEl.textContent = "Слушайте мелодию пластинки...";
  } else if (state.phase === "input") {
    statusLineEl.textContent = "Повторяй мелодию!";
    statusLineEl.classList.add("is-repeat");
  } else if (state.phase === "gameover") {
    statusLineEl.textContent = `Вы дошли до уровня ${state.round}`;
    statusLineEl.classList.add("is-error");
  } else {
    statusLineEl.textContent = "Нажмите «Старт», чтобы поставить пластинку";
  }

  const activeDeck = state.phase === "showing" || state.phase === "input";
  vinylDeckEl.classList.toggle("is-playing", activeDeck);
  vinylDiscEl.classList.toggle("is-spinning", activeDeck);
}

function playSequenceStep(stepIndex, runId) {
  if (runId !== state.runId || state.phase !== "showing") return;

  if (stepIndex >= state.sequence.length) {
    state.phase = "input";
    state.playerIndex = 0;
    render();
    return;
  }

  const padIndex = state.sequence[stepIndex];
  flashPad(padIndex, runId, LIGHT_DURATION_MS);

  scheduleTimer(() => {
    playSequenceStep(stepIndex + 1, runId);
  }, LIGHT_DURATION_MS + STEP_GAP_MS, runId);
}

function startNextRound(runId) {
  if (runId !== state.runId) return;

  const nextPad = Math.floor(Math.random() * 4);
  state.sequence.push(nextPad);
  state.round = state.sequence.length;
  state.playerIndex = 0;
  state.phase = "showing";
  render();

  scheduleTimer(() => {
    playSequenceStep(0, runId);
  }, ROUND_START_DELAY_MS, runId);
}

function startGame() {
  state.runId += 1;
  const currentRunId = state.runId;

  clearAllTimers();
  for (const padEl of padButtons) {
    padEl.classList.remove("active");
  }

  state.sequence = [];
  state.playerIndex = 0;
  state.round = 0;
  state.phase = "showing";
  render();

  startNextRound(currentRunId);
}

function handlePadClick(event) {
  if (state.phase !== "input") return;

  const padEl = event.currentTarget;
  const padIndex = Number(padEl.dataset.pad);
  if (Number.isNaN(padIndex)) return;

  const currentRunId = state.runId;
  flashPad(padIndex, currentRunId, 240);

  const expectedPad = state.sequence[state.playerIndex];
  if (padIndex !== expectedPad) {
    clearAllTimers();
    state.phase = "gameover";
    render();
    return;
  }

  state.playerIndex += 1;
  render();

  if (state.playerIndex === state.sequence.length) {
    state.phase = "showing";
    render();
    scheduleTimer(() => {
      startNextRound(currentRunId);
    }, ROUND_START_DELAY_MS, currentRunId);
  }
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  soundBtnEl.setAttribute("aria-pressed", String(state.soundEnabled));
  soundBtnEl.textContent = state.soundEnabled ? "Звук: вкл" : "Звук: выкл";
}

for (const padEl of padButtons) {
  padEl.addEventListener("click", handlePadClick);
}

startBtnEl.addEventListener("click", startGame);
soundBtnEl.addEventListener("click", toggleSound);

render();