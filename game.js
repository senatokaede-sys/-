const titleScreen = document.getElementById('titleScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('finalScore');
const difficultyLabel = document.getElementById('difficultyLabel');
const bestScoreEl = document.getElementById('bestScore');
const resultMessage = document.getElementById('resultMessage');

const retryButton = document.getElementById('retryButton');
const backButton = document.getElementById('backButton');

const difficulties = {
  easy: { label: 'EASY', enemySpeed: 1.5, spawnRate: 1200, bulletSpeed: 6 },
  normal: { label: 'NORMAL', enemySpeed: 2.2, spawnRate: 950, bulletSpeed: 7 },
  hard: { label: 'HARD', enemySpeed: 3.2, spawnRate: 750, bulletSpeed: 8 },
};

let audioContext;
let bestScore = Number(localStorage.getItem('skyline-best') || 0);
let animationId;
let lastSpawn = 0;
let lastShot = 0;
let lastFrameTime = 0;

const state = {
  running: false,
  score: 0,
  difficulty: difficulties.normal,
  difficultyKey: 'normal',
  player: { x: 240, y: 610, radius: 18 },
  bullets: [],
  enemies: [],
  explosions: [],
};

const gradientStars = Array.from({ length: 80 }).map(() => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  speed: 0.3 + Math.random() * 0.8,
  size: 0.6 + Math.random() * 1.4,
}));

const playTone = (frequency, duration = 0.12, volume = 0.1, type = 'sine') => {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.value = frequency;
  osc.type = type;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  osc.stop(audioContext.currentTime + duration);
};

const initAudio = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
};

const resetGame = () => {
  state.score = 0;
  state.bullets = [];
  state.enemies = [];
  state.explosions = [];
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height - 100;
  scoreEl.textContent = '0';
  lastSpawn = 0;
  lastShot = 0;
  lastFrameTime = performance.now();
};

const startGame = (difficultyKey) => {
  state.difficultyKey = difficulties[difficultyKey] ? difficultyKey : 'normal';
  state.difficulty = difficulties[state.difficultyKey];
  difficultyLabel.textContent = state.difficulty.label;
  titleScreen.hidden = true;
  gameOverScreen.hidden = true;
  gameScreen.hidden = false;
  resetGame();
  initAudio();
  state.running = true;
  animationId = requestAnimationFrame(loop);
};

const endGame = () => {
  state.running = false;
  cancelAnimationFrame(animationId);
  gameScreen.hidden = true;
  gameOverScreen.hidden = false;
  finalScoreEl.textContent = state.score;
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem('skyline-best', bestScore);
    bestScoreEl.textContent = `BEST ${bestScore}`;
    resultMessage.textContent = '新記録！美しいフライトだった。';
  } else {
    resultMessage.textContent = 'あと一歩！もう一度挑戦しよう。';
  }
};

const spawnEnemy = () => {
  const radius = 16 + Math.random() * 12;
  state.enemies.push({
    x: radius + Math.random() * (canvas.width - radius * 2),
    y: -radius,
    radius,
    speed: state.difficulty.enemySpeed + Math.random() * 0.6,
  });
};

const shoot = () => {
  state.bullets.push({
    x: state.player.x,
    y: state.player.y - 24,
    radius: 6,
    speed: state.difficulty.bulletSpeed,
  });
  playTone(880, 0.08, 0.08, 'triangle');
};

const addExplosion = (x, y, radius) => {
  state.explosions.push({ x, y, radius, life: 1 });
  playTone(160, 0.2, 0.12, 'sawtooth');
};

const update = (time) => {
  const delta = time - lastFrameTime;
  lastFrameTime = time;

  gradientStars.forEach((star) => {
    star.y += star.speed * (delta / 16);
    if (star.y > canvas.height) {
      star.y = -2;
      star.x = Math.random() * canvas.width;
    }
  });

  if (time - lastSpawn > state.difficulty.spawnRate) {
    spawnEnemy();
    lastSpawn = time;
  }

  if (time - lastShot > 220) {
    shoot();
    lastShot = time;
  }

  state.bullets.forEach((bullet) => {
    bullet.y -= bullet.speed * (delta / 16);
  });

  state.enemies.forEach((enemy) => {
    enemy.y += enemy.speed * (delta / 16);
  });

  state.explosions.forEach((explosion) => {
    explosion.life -= 0.04 * (delta / 16);
  });

  state.bullets = state.bullets.filter((bullet) => bullet.y > -20);
  state.enemies = state.enemies.filter((enemy) => enemy.y < canvas.height + 40);
  state.explosions = state.explosions.filter((explosion) => explosion.life > 0);

  state.enemies.forEach((enemy, enemyIndex) => {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < enemy.radius + state.player.radius) {
      addExplosion(state.player.x, state.player.y, 40);
      endGame();
    }

    state.bullets.forEach((bullet, bulletIndex) => {
      const bx = enemy.x - bullet.x;
      const by = enemy.y - bullet.y;
      if (Math.hypot(bx, by) < enemy.radius + bullet.radius) {
        addExplosion(enemy.x, enemy.y, enemy.radius + 12);
        state.enemies.splice(enemyIndex, 1);
        state.bullets.splice(bulletIndex, 1);
        state.score += 100;
        scoreEl.textContent = state.score;
      }
    });
  });
};

const draw = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(21, 40, 78, 0.9)');
  gradient.addColorStop(1, 'rgba(4, 6, 12, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  gradientStars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.fillStyle = '#68d5ff';
  ctx.shadowColor = 'rgba(104, 213, 255, 0.8)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y - 18);
  ctx.lineTo(state.player.x - 14, state.player.y + 14);
  ctx.lineTo(state.player.x + 14, state.player.y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#4af0a1';
  state.bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  state.enemies.forEach((enemy) => {
    ctx.save();
    ctx.fillStyle = '#ff5470';
    ctx.shadowColor = 'rgba(255, 84, 112, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  state.explosions.forEach((explosion) => {
    ctx.save();
    ctx.globalAlpha = Math.max(explosion.life, 0);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * (1.3 - explosion.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

const loop = (time) => {
  if (!state.running) return;
  update(time);
  draw();
  animationId = requestAnimationFrame(loop);
};

const pointerMove = (event) => {
  if (!state.running) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  state.player.x = Math.max(state.player.radius, Math.min(canvas.width - state.player.radius, x));
  state.player.y = Math.max(state.player.radius, Math.min(canvas.height - state.player.radius, y));
};

canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('touchmove', pointerMove, { passive: true });

document.querySelectorAll('[data-difficulty]').forEach((button) => {
  button.addEventListener('click', () => {
    startGame(button.dataset.difficulty);
  });
});

retryButton.addEventListener('click', () => startGame(state.difficultyKey));
backButton.addEventListener('click', () => {
  gameOverScreen.hidden = true;
  titleScreen.hidden = false;
});

bestScoreEl.textContent = `BEST ${bestScore}`;
