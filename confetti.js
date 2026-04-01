// ===== Confetti Effect =====

const PARTICLE_COUNT = 40;
const GRAVITY = 0.000093;

// ===== Spritesheet =====
const SPRITE_COLS = 7;
const SPRITE_ROWS = 4;
const SPRITE_CELL = 50;
const SPRITE_TOTAL = SPRITE_COLS * SPRITE_ROWS;
const SPRITE_URL = './images/confetti.png';

let $canvas = null;
let ctx = null;
let particles = [];
let animationId = null;
let spriteSheet = null;

function ensureSpriteSheet() {
  if (spriteSheet) return;
  spriteSheet = new Image();
  spriteSheet.src = SPRITE_URL;
}

function createParticle() {
  const spriteIndex = Math.floor(Math.random() * SPRITE_TOTAL);
  const size = Math.random() * 28 + 28;
  // Angle: mostly upward, spread ~120deg (from -60deg to +60deg)
  const angle = (Math.random() - 0.5) * ((Math.PI * 2) / 1); // -60°..+60°
  const speed = Math.random() * 0.0008; // slower, less spread
  return {
    x: 0.5,
    y: 0.5,
    vx: Math.sin(angle) * speed * 4,
    vy:
      (-Math.abs((Math.cos(angle) * speed) / 2) -
        0.008 -
        Math.random() * 0.004) /
      1.4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    size,
    spriteIndex,
    opacity: 1,
  };
}

function ensureCanvas() {
  if ($canvas) return;
  $canvas = document.createElement('canvas');
  $canvas.id = '$confettiCanvas';
  $canvas.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:3;';
  document.body.appendChild($canvas);
  ctx = $canvas.getContext('2d');
}

function resize() {
  if (!$canvas) return;
  $canvas.width = window.innerWidth;
  $canvas.height = window.innerHeight;
}

function tick() {
  if (!ctx || particles.length === 0) {
    stop();
    return;
  }

  ctx.clearRect(0, 0, $canvas.width, $canvas.height);
  const w = $canvas.width;
  const h = $canvas.height;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx;
    p.vy += GRAVITY;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;

    // Fade out near bottom
    if (p.y > 0.8) {
      p.opacity = Math.max(0, 1 - (p.y - 0.8) / 0.2);
    }

    if (p.y > 1.1 || p.opacity <= 0) {
      particles.splice(i, 1);
      continue;
    }

    const px = p.x * w;
    const py = p.y * h;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.globalAlpha = p.opacity;

    if (spriteSheet?.complete && spriteSheet.naturalWidth > 0) {
      const col = p.spriteIndex % SPRITE_COLS;
      const row = Math.floor(p.spriteIndex / SPRITE_COLS);
      const sx = col * SPRITE_CELL;
      const sy = row * SPRITE_CELL;
      const half = p.size / 2;
      ctx.drawImage(
        spriteSheet,
        sx,
        sy,
        SPRITE_CELL,
        SPRITE_CELL,
        -half,
        -half,
        p.size,
        p.size,
      );
    } else {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(-4, -3, 8, 6);
    }

    ctx.restore();
  }

  animationId = requestAnimationFrame(tick);
}

function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (ctx && $canvas) {
    ctx.clearRect(0, 0, $canvas.width, $canvas.height);
  }
  particles = [];
}

export function launchConfetti() {
  ensureCanvas();
  ensureSpriteSheet();
  resize();
  stop();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle());
  }

  window.addEventListener('resize', resize);
  animationId = requestAnimationFrame(tick);
}

export function stopConfetti() {
  stop();
  window.removeEventListener('resize', resize);
}

// todo(vmyshko): for debug
window.launchConfetti = launchConfetti;
