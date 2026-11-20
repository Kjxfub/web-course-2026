// --- 1. Состояние приложения ---
const state = {
  secret: "",
  attempts: [], // элементы вида { guess: "1234", bulls: 1, cows: 2 }
  isGameOver: false,
  message: "",
  messageType: "" // "" | "error" | "win"
};

// --- 2. Ссылки на элементы DOM ---
const formEl = document.getElementById("guess-form");
const inputEl = document.getElementById("guess-input");
const checkBtnEl = document.getElementById("check-btn");
const newGameBtnEl = document.getElementById("new-game-btn");
const attemptsCountEl = document.getElementById("attempts-count");
const messageEl = document.getElementById("message");
const historyListEl = document.getElementById("history-list");

// --- 3. Обязательные отдельные функции логики ---

/**
 * Генерирует строку из 4 неповторяющихся цифр от '0' до '9'.
 */
function generateSecretNumber() {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  // Тасование Фишера — Йетса
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }

  return digits.slice(0, 4).join("");
}

/**
 * Проверяет ввод игрока:
 * - ровно 4 символа
 * - только цифры (0-9)
 * - все 4 цифры различны
 * Возвращает { valid: true, value: "1234" } или { valid: false, error: "..." }.
 */
function validateGuess(rawInput) {
  const value = rawInput.trim();

  if (!/^\d{4}$/.test(value)) {
    return {
      valid: false,
      error: "Введите ровно 4 цифры (только символы 0–9, без пробелов и букв)."
    };
  }

  const uniqueDigits = new Set(value.split(""));
  if (uniqueDigits.size !== 4) {
    return {
      valid: false,
      error: "Все 4 цифры должны быть разными (без повторений)."
    };
  }

  return { valid: true, value };
}

/**
 * Считает количество быков и коров для загаданного числа и попытки.
 * Предполагается, что обе строки состоят из 4 неповторяющихся цифр.
 */
function countBullsAndCows(secret, guess) {
  let bulls = 0;
  let cows = 0;

  for (let i = 0; i < guess.length; i++) {
    const digit = guess[i];
    if (digit === secret[i]) {
      bulls++;
    } else if (secret.includes(digit)) {
      cows++;
    }
  }

  return { bulls, cows };
}

// --- 4. Вспомогательные функции форматирования и рендера ---

function pluralize(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatAttemptLine(attempt) {
  const bullWord = pluralize(attempt.bulls, "бык", "быка", "быков");
  const cowWord = pluralize(attempt.cows, "корова", "коровы", "коров");
  return `${attempt.guess} → ${attempt.bulls} ${bullWord}, ${attempt.cows} ${cowWord}`;
}

/**
 * Полностью синхронизирует интерфейс с текущим объектом state.
 */
function render() {
  attemptsCountEl.textContent = String(state.attempts.length);

  messageEl.textContent = state.message;
  messageEl.className = "message";
  if (state.messageType) {
    messageEl.classList.add(state.messageType);
  }

  inputEl.disabled = state.isGameOver;
  checkBtnEl.disabled = state.isGameOver;

  // Перерисовываем историю строго из массива state.attempts
  historyListEl.innerHTML = "";
  for (const attempt of state.attempts) {
    const li = document.createElement("li");
    li.textContent = formatAttemptLine(attempt);
    historyListEl.appendChild(li);
  }
}

// --- 5. Управление жизненным циклом игры и событиями ---

function startNewGame() {
  state.secret = generateSecretNumber();
  state.attempts = [];
  state.isGameOver = false;
  state.message = "";
  state.messageType = "";

  inputEl.value = "";
  render();
  inputEl.focus();
}

function handleGuessSubmit(event) {
  event.preventDefault(); // чтобы форма не перезагружала страницу

  if (state.isGameOver) {
    return;
  }

  const validation = validateGuess(inputEl.value);
  if (!validation.valid) {
    // Попытка НЕ засчитывается в state.attempts
    state.message = validation.error;
    state.messageType = "error";
    render();
    return;
  }

  const guess = validation.value;
  const { bulls, cows } = countBullsAndCows(state.secret, guess);

  state.attempts.push({ guess, bulls, cows });
  inputEl.value = "";

  if (bulls === 4) {
    state.isGameOver = true;
    state.message = `Победа! Угадано за ${state.attempts.length} попыток`;
    state.messageType = "win";
  } else {
    state.message = "";
    state.messageType = "";
  }

  render();
  if (!state.isGameOver) {
    inputEl.focus();
  }
}

formEl.addEventListener("submit", handleGuessSubmit);
newGameBtnEl.addEventListener("click", startNewGame);

// Запуск при загрузке страницы
startNewGame();