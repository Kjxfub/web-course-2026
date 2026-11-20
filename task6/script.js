// Chalk & Snake — Лабораторная работа №6.
// Все изменения состояния игры происходят в update(); вся отрисовка — в draw().
// requestAnimationFrame обеспечивает цикл анимации; фиксированный шаг времени управляет скоростью.
const GRID = 20;
const CELL = 30;
const SIZE = GRID * CELL;
const MOVE_INTERVAL = 150; // миллисекунд на клетку сетки, независимо от FPS монитора
const DIRECTIONS = Object.freeze({
  up: {x: 0, y: -1}, down: {x: 0, y: 1},
  left: {x: -1, y: 0}, right: {x: 1, y: 0}
});
const BALLS = [
  {number: 1, color: '#edbe32', name: 'Жёлтый'},
  {number: 2, color: '#235bb4', name: 'Синий'},
  {number: 3, color: '#c5392d', name: 'Красный'},
  {number: 4, color: '#67369f', name: 'Фиолетовый'},
  {number: 5, color: '#e58e26', name: 'Оранжевый'},
  {number: 6, color: '#278052', name: 'Зелёный'},
  {number: 7, color: '#772d33', name: 'Бордовый'},
  {number: 8, color: '#24262a', name: 'Чёрный'},
  {number: 9, color: '#edbe32', name: 'Жёлтый в полоску'},
  {number: 10, color: '#235bb4', name: 'Синий в полоску'},
  {number: 11, color: '#c5392d', name: 'Красный в полоску'},
  {number: 12, color: '#67369f', name: 'Фиолетовый в полоску'},
  {number: 13, color: '#e58e26', name: 'Оранжевый в полоску'},
  {number: 14, color: '#278052', name: 'Зелёный в полоску'},
  {number: 15, color: '#772d33', name: 'Бордовый в полоску'}
];

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', {alpha: false});
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('bestScore');
const ballNameEl = document.getElementById('ballName');
const ballPreviewEl = document.getElementById('ballPreview');
const ballPreviewNumber = document.getElementById('ballPreviewNumber');
const ballTrayEl = document.getElementById('ballTray');
const overlay = document.getElementById('gameOverlay');
const overlayKicker = document.getElementById('overlayKicker');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayHelp = document.getElementById('overlayHelp');
const startButton = document.getElementById('startButton');
const startButtonText = document.getElementById('startButtonText');
const gridButton = document.getElementById('gridButton');
const soundButton = document.getElementById('soundButton');

const layer = document.createElement('canvas');
layer.width = SIZE;
layer.height = SIZE;
const layerCtx = layer.getContext('2d');
const feltImage = new Image();
const scalesImage = new Image();
let skinPattern = null;
let backgroundReady = false;
let showGrid = true;
let soundEnabled = false;
let audioContext = null;

const game = {
  snake: [],
  previousSnake: [],
  direction: DIRECTIONS.right,
  nextDirection: null,
  ball: null,
  score: 0,
  bestScore: readBestScore(),
  collected: [],
  status: 'ready', // ready | playing | paused | gameover | won
  accumulator: 0,
  lastFrame: 0
};

function readBestScore() {
  try { return Math.max(0, Number(localStorage.getItem('chalk-snake-best')) || 0); }
  catch { return 0; }
}
function saveBestScore(value) {
  try { localStorage.setItem('chalk-snake-best', String(value)); }
  catch { /* Игра также работает в режиме инкогнито или при открытии через file://. */ }
}
function padScore(number) { return String(number).padStart(2, '0'); }
function cellCenter(point) {
  return {x: (point.x + 0.5) * CELL, y: (point.y + 0.5) * CELL};
}
function sameCell(a, b) { return a.x === b.x && a.y === b.y; }

function resetGame() {
  game.snake = [{x: 6, y: 10}, {x: 5, y: 10}, {x: 4, y: 10}];
  game.previousSnake = game.snake.map(part => ({...part}));
  game.direction = DIRECTIONS.right;
  game.nextDirection = null;
  game.score = 0;
  game.collected = [];
  game.status = 'ready';
  game.accumulator = 0;
  game.lastFrame = 0;
  game.ball = spawnApple();
  updateInterface();
}

// Равномерно выбираем одну из свободных клеток. Никогда не ставим шар на змейку.
function spawnApple() {
  const freeCells = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!game.snake.some(segment => segment.x === x && segment.y === y)) {
        freeCells.push({x, y});
      }
    }
  }
  if (freeCells.length === 0) return null;
  const position = freeCells[Math.floor(Math.random() * freeCells.length)];
  const previousNumber = game.ball?.number;
  const availableBalls = BALLS.filter(ball => ball.number !== previousNumber);
  const appearance = availableBalls[Math.floor(Math.random() * availableBalls.length)];
  return {...position, ...appearance};
}

function checkCollision(nextHead, willEat) {
  if (nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= GRID || nextHead.y >= GRID) {
    return true;
  }
  // Заходить в клетку, которую только что освободил хвост, разрешено, если змейка не съела шар.
  const occupied = willEat ? game.snake : game.snake.slice(0, -1);
  return occupied.some(segment => sameCell(segment, nextHead));
}

function moveSnake() {
  if (game.nextDirection) {
    game.direction = game.nextDirection;
    game.nextDirection = null;
  }
  const head = game.snake[0];
  const nextHead = {x: head.x + game.direction.x, y: head.y + game.direction.y};
  const willEat = game.ball !== null && sameCell(nextHead, game.ball);

  if (checkCollision(nextHead, willEat)) {
    finishGame(false);
    return;
  }

  game.previousSnake = game.snake.map(segment => ({...segment}));
  game.snake.unshift(nextHead);
  if (willEat) {
    game.collected.push(game.ball);
    game.score += 1;
    if (game.score > game.bestScore) {
      game.bestScore = game.score;
      saveBestScore(game.bestScore);
    }
    game.ball = spawnApple();
    playSound('eat');
    updateInterface();
    if (game.ball === null) finishGame(true);
  } else {
    game.snake.pop();
  }
}

// Обновление только состояния; никакой отрисовки или работы с DOM при движении.
function update() {
  if (game.status === 'playing') moveSnake();
}

// Накопитель времени обеспечивает предсказуемую скорость на 60/120/144 Гц и ниже.
function animationFrame(timestamp) {
  if (game.lastFrame === 0) game.lastFrame = timestamp;
  const deltaTime = Math.max(0, Math.min(timestamp - game.lastFrame, MOVE_INTERVAL * 4));
  game.lastFrame = timestamp;
  if (game.status === 'playing') {
    game.accumulator += deltaTime;
    while (game.accumulator >= MOVE_INTERVAL && game.status === 'playing') {
      game.accumulator -= MOVE_INTERVAL;
      update();
    }
  }
  draw(game.status === 'playing' ? game.accumulator / MOVE_INTERVAL : 1);
  requestAnimationFrame(animationFrame);
}

function chooseDirection(name) {
  const proposed = DIRECTIONS[name];
  if (!proposed || game.status !== 'playing') return;
  // Ровно один поставленный в очередь поворот за такт движения; это также защищает от резкого разворота на 180°.
  if (game.nextDirection) return;
  if (proposed.x === -game.direction.x && proposed.y === -game.direction.y) return;
  if (proposed.x === game.direction.x && proposed.y === game.direction.y) return;
  game.nextDirection = proposed;
}

function showOverlay(mode) {
  const content = {
    ready: {
      kicker: 'WELCOME TO THE TABLE', title: 'Ваша<br><em>партия.</em>',
      text: 'Собирайте бильярдные шары, растите и не касайтесь бортов или собственного хвоста.',
      button: 'НАЧАТЬ ИГРУ', help: 'СТРЕЛКИ — ДВИЖЕНИЕ · ПРОБЕЛ — ПАУЗА'
    },
    paused: {
      kicker: 'TAKE YOUR TIME', title: 'Тайм-<br><em>аут.</em>',
      text: 'Партия на паузе. Шары никуда не денутся.',
      button: 'ПРОДОЛЖИТЬ', help: 'ПРОБЕЛ — ПРОДОЛЖИТЬ'
    },
    gameover: {
      kicker: 'END OF THE ROUND', title: 'Игра<br><em>окончена.</em>',
      text: `Вы собрали ${game.score} ${scoreWord(game.score)}. Попробуйте побить собственный рекорд.`,
      button: 'НАЧАТЬ ЗАНОВО', help: `ИТОГОВЫЙ СЧЁТ — ${padScore(game.score)}`
    },
    won: {
      kicker: 'A PERFECT GAME', title: 'Вся<br><em>партия!</em>',
      text: `Невероятно! Вы заняли все ${GRID * GRID} клеток стола.`,
      button: 'ИГРАТЬ СНОВА', help: `ИТОГОВЫЙ СЧЁТ — ${padScore(game.score)}`
    }
  }[mode];
  if (!content) { overlay.classList.remove('visible'); return; }
  overlayKicker.textContent = content.kicker;
  overlayTitle.innerHTML = content.title;
  overlayText.textContent = content.text;
  startButtonText.textContent = content.button;
  overlayHelp.textContent = content.help;
  overlay.classList.add('visible');
}
function scoreWord(amount) {
  const last = amount % 10, lastTwo = amount % 100;
  if (last === 1 && lastTwo !== 11) return 'шар';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'шара';
  return 'шаров';
}
function beginGame() {
  if (game.status === 'paused') {
    game.status = 'playing';
  } else {
    resetGame();
    game.status = 'playing';
  }
  game.lastFrame = 0;
  game.accumulator = 0;
  showOverlay(null);
  startButton.blur();
}
function pauseGame() {
  if (game.status === 'playing') {
    game.status = 'paused';
    game.accumulator = 0;
    game.nextDirection = null;
    showOverlay('paused');
  } else if (game.status === 'paused') beginGame();
}
function finishGame(won) {
  game.status = won ? 'won' : 'gameover';
  game.nextDirection = null;
  playSound(won ? 'eat' : 'lose');
  showOverlay(game.status);
}
function updateInterface() {
  scoreEl.textContent = padScore(game.score);
  bestEl.textContent = padScore(game.bestScore);
  const ball = game.ball;
  if (ball) {
    ballNameEl.textContent = ball.name;
    ballPreviewNumber.textContent = ball.number;
    ballPreviewEl.style.setProperty('--ball-color', ball.color);
    ballPreviewEl.classList.toggle('stripe', ball.number > 8);
  }
  ballTrayEl.replaceChildren();
  if (game.collected.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'tray-empty';
    empty.textContent = 'Здесь появятся собранные шары';
    ballTrayEl.append(empty);
  } else {
    for (const eaten of game.collected.slice(-18)) {
      const icon = document.createElement('span');
      icon.className = 'tray-ball';
      icon.style.setProperty('--ball-color', eaten.color);
      icon.title = `Шар №${eaten.number}`;
      icon.textContent = eaten.number;
      ballTrayEl.append(icon);
    }
  }
}

// ------------------------------------------------------------
// ОТРИСОВКА НА CANVAS: фон, бильярдные шары, змейка, мел на хвосте
// ------------------------------------------------------------
function makeBackground() {
  const g = layerCtx;
  const base = g.createLinearGradient(0, 0, SIZE, SIZE);
  base.addColorStop(0, '#194d34');
  base.addColorStop(0.5, '#21583c');
  base.addColorStop(1, '#0b2c20');
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  if (feltImage.complete && feltImage.naturalWidth) {
    g.save();
    g.globalAlpha = .35;
    g.fillStyle = g.createPattern(feltImage, 'repeat');
    g.fillRect(0, 0, SIZE, SIZE);
    g.restore();
  }
  // Плавное пятно тёплого света под подвесным светильником.
  const light = g.createRadialGradient(290, 65, 10, 290, 90, 570);
  light.addColorStop(0, 'rgba(245,194,107,0.23)');
  light.addColorStop(.4, 'rgba(188,159,96,0.10)');
  light.addColorStop(1, 'rgba(4,11,8,0)');
  g.fillStyle = light;
  g.fillRect(0, 0, SIZE, SIZE);
  if (showGrid) {
    g.strokeStyle = 'rgba(235,237,195,.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = i * CELL + .5;
      g.moveTo(p, 0); g.lineTo(p, SIZE);
      g.moveTo(0, p); g.lineTo(SIZE, p);
    }
    g.stroke();
  }
  const vignette = g.createRadialGradient(300, 290, 140, 300, 300, 465);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(.7, 'rgba(0,0,0,0.06)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.43)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 11;
  g.strokeRect(0, 0, SIZE, SIZE);
  backgroundReady = true;
}

function drawBall(ball) {
  if (!ball) return;
  const {x, y} = cellCenter(ball);
  const radius = 12.2;
  ctx.save();
  ctx.fillStyle = 'rgba(1,9,4,.45)';
  ctx.beginPath();
  ctx.ellipse(x + 3.8, y + 7.8, 12, 5.7, -.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  const bright = ctx.createRadialGradient(x - 4, y - 5, .4, x + 3.3, y + 3.5, 18.5);
  if (ball.number > 8) {
    bright.addColorStop(0, '#fffdf3'); bright.addColorStop(.48, '#f6eee1');
    bright.addColorStop(1, '#857b72');
  } else {
    bright.addColorStop(0, tint(ball.color, .46));
    bright.addColorStop(.48, ball.color);
    bright.addColorStop(1, tint(ball.color, -.67));
  }
  ctx.fillStyle = bright;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  if (ball.number > 8) {
    ctx.translate(x, y);
    ctx.rotate(-.16);
    const band = ctx.createLinearGradient(-12, -8, 13, 8);
    band.addColorStop(0, tint(ball.color, .18));
    band.addColorStop(.65, ball.color);
    band.addColorStop(1, tint(ball.color, -.56));
    ctx.fillStyle = band;
    ctx.fillRect(-14, -6.5, 28, 13);
    ctx.rotate(.16);
    ctx.translate(-x, -y);
  }
  // Плашка с номером и небольшим реалистичным бликом бильярдного шара.
  ctx.fillStyle = '#f1e9d8';
  ctx.beginPath();
  ctx.arc(x + 1, y + 1, ball.number >= 10 ? 5.9 : 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1712';
  ctx.font = `bold ${ball.number >= 10 ? '7' : '9'}px Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(ball.number), x + 1, y + .6);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.beginPath();
  ctx.ellipse(x - 4.7, y - 6.6, 2.8, 1.8, -.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 3.65, 5.15);
  ctx.stroke();
  ctx.restore();
}

// Смешивание цветов без сторонних библиотек. Положительное значение добавляет белый, отрицательное — чёрный.
function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const result = [16, 8, 0].map(shift => {
    const channel = (n >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))));
  });
  return `rgb(${result.join(',')})`;
}

function snakeCoordinates(progress) {
  return game.snake.map((segment, index) => {
    const old = game.previousSnake[index] ?? game.previousSnake[game.previousSnake.length - 1] ?? segment;
    return cellCenter({
      x: old.x + (segment.x - old.x) * progress,
      y: old.y + (segment.y - old.y) * progress
    });
  });
}

// Интерполяция кривой делает сеточную змейку органичной, не меняя логику столкновений.
function catmullRom(points, subdivisions = 8) {
  if (points.length < 2) return points;
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[i];
    const c = points[i + 1];
    const d = points[Math.min(points.length - 1, i + 2)];
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions, t2 = t * t, t3 = t2 * t;
      result.push({
        x: .5 * ((2 * b.x) + (-a.x + c.x) * t + (2*a.x - 5*b.x + 4*c.x - d.x) * t2 + (-a.x + 3*b.x - 3*c.x + d.x) * t3),
        y: .5 * ((2 * b.y) + (-a.y + c.y) * t + (2*a.y - 5*b.y + 4*c.y - d.y) * t2 + (-a.y + 3*b.y - 3*c.y + d.y) * t3)
      });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function resample(points, spacing) {
  const out = [points[0]];
  let accumulated = 0;
  for (let i = 1; i < points.length; i++) {
    let from = {...points[i - 1]};
    const to = points[i];
    let length = Math.hypot(to.x - from.x, to.y - from.y);
    while (length > 0 && accumulated + length >= spacing) {
      const fraction = (spacing - accumulated) / length;
      const p = {x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction};
      out.push(p);
      from = p;
      length = Math.hypot(to.x - from.x, to.y - from.y);
      accumulated = 0;
    }
    accumulated += length;
  }
  const last = points[points.length - 1];
  if (Math.hypot(out[out.length - 1].x - last.x, out[out.length - 1].y - last.y) > 1) out.push(last);
  return out;
}

function orientation(points, index) {
  const before = points[Math.max(0, index - 1)];
  const after = points[Math.min(points.length - 1, index + 1)];
  const angle = Math.atan2(after.y - before.y, after.x - before.x);
  return {angle, nx: -Math.sin(angle), ny: Math.cos(angle)};
}

function bodyOutline(points) {
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const {nx, ny} = orientation(points, i);
    const t = i / Math.max(1, points.length - 1);
    // Тело толще ближе к голове; хвост плавно сужается и переходит в мел.
    const width = 10.5 * (1 - .43 * Math.pow(t, 5));
    left.push({x: p.x + nx * width, y: p.y + ny * width});
    right.push({x: p.x - nx * width, y: p.y - ny * width});
  }
  const path = new Path2D();
  path.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) path.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i].x, right[i].y);
  path.closePath();
  return path;
}

function drawSnake(progress) {
  const cellPoints = snakeCoordinates(progress);
  const curve = catmullRom(cellPoints);
  const smooth = resample(curve, 3.5);
  const skin = bodyOutline(smooth);

  ctx.save();
  ctx.shadowOffsetY = 6;
  ctx.shadowOffsetX = 4;
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(0,0,0,.65)';
  ctx.fillStyle = '#241a13';
  ctx.fill(skin);
  ctx.restore();

  ctx.save();
  const bodyLight = ctx.createLinearGradient(0, 60, 500, 540);
  bodyLight.addColorStop(0, '#e2bd7e');
  bodyLight.addColorStop(.38, '#bb935f');
  bodyLight.addColorStop(.75, '#e7c58b');
  bodyLight.addColorStop(1, '#ac7b48');
  ctx.fillStyle = bodyLight;
  ctx.fill(skin);
  ctx.clip(skin);

  // Тёмные пятна в духе питона, расположенные вдоль реального изгиба тела.
  const patches = resample(curve, 21);
  for (let i = 1; i < patches.length - 1; i++) {
    const point = patches[i];
    const {angle, nx, ny} = orientation(patches, i);
    const side = i % 2 === 0 ? -1 : 1;
    ctx.save();
    ctx.translate(point.x + nx * side * 5, point.y + ny * side * 5);
    ctx.rotate(angle + (i % 3 - 1) * .16);
    ctx.fillStyle = i % 4 === 0 ? '#38291d' : '#493122';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 + (i % 3) * 1.5, 6 + (i % 2) * 1.5, .25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,20,14,.5)';
    ctx.beginPath();
    ctx.ellipse(4, -2.5 * side, 4.2, 2.8, -.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Настоящее фото змеиной чешуи используется как лёгкий текстурный слой.
  if (skinPattern) {
    ctx.globalAlpha = .30;
    ctx.fillStyle = skinPattern;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  }
  // Мелкие рельефные чешуйки внахлёст по локальному направлению изгиба.
  const scaleCenters = resample(curve, 4.6);
  for (let i = 1; i < scaleCenters.length - 1; i++) {
    const p = scaleCenters[i];
    const {angle, nx, ny} = orientation(scaleCenters, i);
    for (let lane = -2; lane <= 2; lane++) {
      const shift = lane * 3.5 + (i % 2) * 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x + nx * shift, p.y + ny * shift,
        2.25, 1.7, angle + Math.PI / 2, 0, Math.PI * 1.05);
      ctx.strokeStyle = (i + lane) % 3 === 0 ? 'rgba(40,26,17,.28)' : 'rgba(255,235,185,.26)';
      ctx.lineWidth = .7;
      ctx.stroke();
    }
  }
  // Тонкий отблеск вдоль хребта.
  ctx.beginPath();
  ctx.moveTo(smooth[0].x, smooth[0].y);
  for (let i = 1; i < smooth.length; i++) ctx.lineTo(smooth[i].x, smooth[i].y);
  ctx.strokeStyle = 'rgba(255,233,171,.13)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#332319';
  ctx.lineWidth = 1.2;
  ctx.stroke(skin);

  drawSnakeHead(cellPoints[0], cellPoints[1] || cellPoints[0]);
  drawChalk(cellPoints[cellPoints.length - 1], cellPoints[cellPoints.length - 2]);
}

function drawSnakeHead(head, neck) {
  const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);
  ctx.shadowColor = '#000a';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#3c2818';
  ctx.beginPath();
  ctx.ellipse(3.5, 0, 15.4, 10.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const headSkin = ctx.createLinearGradient(0, -11, 0, 11);
  headSkin.addColorStop(0, '#967248');
  headSkin.addColorStop(.3, '#eed4a1');
  headSkin.addColorStop(.65, '#c1a078');
  headSkin.addColorStop(1, '#6b4e30');
  ctx.fillStyle = headSkin;
  ctx.beginPath();
  ctx.moveTo(-11, -7.3);
  ctx.bezierCurveTo(-4, -13, 8, -10, 17, -4.4);
  ctx.quadraticCurveTo(21, 0, 17, 4.4);
  ctx.bezierCurveTo(8, 10, -4, 13, -11, 7.3);
  ctx.closePath();ctx.fill();
  ctx.strokeStyle = '#37261a';ctx.lineWidth = 1.3;ctx.stroke();
  // Узор на голове, полосы у глаз и щитки на морде.
  ctx.fillStyle = '#312218';
  ctx.beginPath();ctx.ellipse(-1.5, 0, 7.3, 3.9, 0, 0, Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(9.5, -6.0, 5.0, 1.8, -.27, 0, Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(9.5, 6.0, 5.0, 1.8, .27, 0, Math.PI*2);ctx.fill();
  for (const sign of [-1, 1]) {
    ctx.fillStyle = '#1a100d';
    ctx.beginPath();ctx.ellipse(6, sign * 7.2, 2.7, 2.1, 0, 0, Math.PI*2);ctx.fill();
    ctx.fillStyle = '#d5a15d';
    ctx.beginPath();ctx.arc(6.3, sign * 7.3, 1.16, 0, Math.PI*2);ctx.fill();
    ctx.fillStyle = '#0a0b08';
    ctx.beginPath();ctx.arc(6.5, sign * 7.3, .63, 0, Math.PI*2);ctx.fill();
    ctx.fillStyle = '#20160e';
    ctx.beginPath();ctx.arc(15.4, sign * 2.8, 1.15, 0, Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle = '#f5d9a5a0';ctx.lineWidth = .8;
  ctx.beginPath();ctx.moveTo(8,-1.7);ctx.lineTo(14,-1);ctx.moveTo(8,1.7);ctx.lineTo(14,1);ctx.stroke();
  ctx.restore();
}

function drawChalk(tail, previous) {
  if (!tail) return;
  const angle = previous ? Math.atan2(tail.y - previous.y, tail.x - previous.x) : 0;
  ctx.save();
  ctx.translate(tail.x, tail.y);
  ctx.rotate(angle + Math.PI / 4);
  ctx.shadowColor = '#000b';ctx.shadowOffsetX = 3;ctx.shadowOffsetY = 5;ctx.shadowBlur = 4;
  // Сине-чёрный кубик бильярдного мела с открытым потёртым голубым мелом сверху.
  ctx.fillStyle = '#0a1c2a';
  ctx.beginPath();ctx.roundRect(-9,-9,18,19,2);ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#b8a67d';ctx.fillRect(-9,-9,18,3);
  ctx.fillStyle = '#234b6b';ctx.fillRect(-7.3,-6,14.6,14.6);
  const chalk = ctx.createRadialGradient(-3,-4,1,2,2,11);
  chalk.addColorStop(0,'#79b2c7');chalk.addColorStop(.55,'#2d719a');chalk.addColorStop(1,'#0a293d');
  ctx.fillStyle = chalk;ctx.fillRect(-7,-7,14,14);
  ctx.strokeStyle = '#c9b88b';ctx.lineWidth = 1.1;ctx.strokeRect(-8,-8,16,16);
  ctx.fillStyle = '#153d5d';ctx.beginPath();ctx.ellipse(0,0,4.4,3.8,-.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle = 'rgba(178,222,230,.34)';ctx.lineWidth = 1;ctx.beginPath();ctx.arc(0,0,4.5,.4,Math.PI*1.55);ctx.stroke();
  ctx.restore();
}

// Функция только отрисовки: игровая логика уже обработана в update().
function draw(progress) {
  if (!backgroundReady) makeBackground();
  ctx.drawImage(layer, 0, 0);
  drawBall(game.ball);
  drawSnake(progress);
}

function playSound(kind) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = kind === 'lose' ? 'triangle' : 'sine';
    const now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(kind === 'lose' ? 280 : 520, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'lose' ? 90 : 780, now + .12);
    gain.gain.setValueAtTime(.055, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + .16);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(now);oscillator.stop(now + .17);
  } catch { /* Звук необязателен. */ }
}

const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
};
window.addEventListener('keydown', event => {
  if (KEY_DIRECTIONS[event.key]) {
    event.preventDefault();
    if (game.status === 'ready') beginGame();
    chooseDirection(KEY_DIRECTIONS[event.key]);
  } else if (event.code === 'Space') {
    event.preventDefault();
    if (game.status === 'playing' || game.status === 'paused') pauseGame();
    else beginGame();
  } else if (event.code === 'Enter' && game.status !== 'playing') {
    event.preventDefault();beginGame();
  } else if (event.code === 'KeyR') {
    event.preventDefault();beginGame();
  }
});
startButton.addEventListener('click', beginGame);
gridButton.addEventListener('click', () => {
  showGrid = !showGrid;
  gridButton.setAttribute('aria-pressed', String(showGrid));
  gridButton.innerHTML = `<span class="mini-icon">⊞</span> ${showGrid ? 'Скрыть сетку' : 'Показать сетку'} <span>↗</span>`;
  makeBackground();
});
soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.innerHTML = `<span class="mini-icon">♫</span> ${soundEnabled ? 'Выключить звук' : 'Включить звук'} <span>↗</span>`;
  if (soundEnabled) playSound('eat');
});
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => {
    if (game.status === 'ready') beginGame();
    chooseDirection(button.dataset.direction);
  });
});
// Свайпы для сенсорных устройств; внутренняя сетка остаётся 600px и 20 × 20.
let touchStart = null;
canvas.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  touchStart = {x: touch.clientX, y: touch.clientY};
}, {passive: true});
canvas.addEventListener('touchend', event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
  if (game.status === 'ready') beginGame();
  chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
}, {passive: true});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.status === 'playing') pauseGame();
});

feltImage.onload = makeBackground;
scalesImage.onload = () => { skinPattern = ctx.createPattern(scalesImage, 'repeat'); };
feltImage.src = 'assets/felt.webp';
scalesImage.src = 'assets/snake-scales.webp';
resetGame();
showOverlay('ready');
requestAnimationFrame(animationFrame);