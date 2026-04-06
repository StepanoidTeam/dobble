// ===== Spin Wheel Module =====

// ===== Sector Config =====
const SECTORS = [
  { color: '#ff6b6b', emoji: '💎', value: 500, label: '+500' },
  { color: '#ffd93d', emoji: '🪙', value: 200, label: '+200' },
  { color: '#6bcb77', emoji: '💎', value: 150, label: '+150' },
  { color: '#4d96ff', emoji: '🎁', value: 50, label: '+50' },
  { color: '#ff8fb1', emoji: '🔑', value: 1, label: '+1' },
  { color: '#ffa62b', emoji: '⭐', value: 50, label: '+50' },
  { color: '#845ec2', emoji: '🎁', value: 100, label: '+100' },
  { color: '#ff922b', emoji: '😺', value: 1, label: '+1' },
];

// ===== State =====
let currentRotationDeg = 0;
let spinning = false;
let rafId = null;

// ===== Animation Config =====
const SPIN_DURATION = 5000; // ms

// easeOutQuart: fast start, long gentle deceleration
function easeOut(t) {
  return 1 - (1 - t) ** 4;
}

// ===== Arrow Tick =====
let lastSectorIndex = -1;
let arrowAngle = 0; // current deflection in degrees
let arrowVelocity = 0; // degrees per ms

const ARROW_KICK = -35; // deflection on each sector crossing (degrees)
const ARROW_STIFFNESS = 0.3; // spring pull-back strength (per ms²)
const ARROW_DAMPING = 0.92; // velocity damping per frame

function tickArrow(deg, dt) {
  const count = SECTORS.length;
  const sectorDeg = 360 / count;
  const index = Math.floor((((deg % 360) + 360) % 360) / sectorDeg);

  // kick on sector crossing
  if (lastSectorIndex !== -1 && index !== lastSectorIndex) {
    arrowVelocity += ARROW_KICK;
  }
  lastSectorIndex = index;

  // spring physics: pull back toward 0
  const dtClamped = Math.min(dt, 40); // cap for tab-switch
  arrowVelocity -= arrowAngle * ARROW_STIFFNESS;
  arrowVelocity *= ARROW_DAMPING;
  arrowAngle += arrowVelocity * (dtClamped / 16);

  $wheelArrow.style.rotate = `${Math.min(0, arrowAngle)}deg`;
}

function resetArrow() {
  arrowAngle = 0;
  arrowVelocity = 0;
  lastSectorIndex = -1;
  $wheelArrow.style.rotate = '';
}

// ===== Spin Animation (rAF) =====
function animateSpin(startDeg, totalDelta, onComplete) {
  const startTime = performance.now();
  let lastTime = startTime;

  function frame(now) {
    const elapsed = now - startTime;
    const dt = now - lastTime;
    lastTime = now;
    const progress = Math.min(elapsed / SPIN_DURATION, 1);
    const eased = easeOut(progress);

    const deg = startDeg + totalDelta * eased;
    $wheelRotor.style.transform = `rotate(${deg}deg)`;
    tickArrow(deg, dt);

    if (progress < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = null;
      currentRotationDeg = deg;
      resetArrow();
      onComplete();
    }
  }

  rafId = requestAnimationFrame(frame);
}

// ===== Build Wheel =====
function buildWheel(sectors) {
  const count = sectors.length;
  const sectorDeg = 360 / count;
  const sectorRad = (sectorDeg * Math.PI) / 180;

  $wheelRotor.innerHTML = '';

  // SVG wedge path: a sector from center-bottom of the slice element
  // The slice element is 50% width of the rotor, 50% height, anchored at bottom-center.
  // We draw a wedge inside a viewBox that spans the sector angle.
  // viewBox: the slice is a tall strip from center to edge.
  // Wedge half-angle = sectorDeg/2
  const halfAngle = sectorDeg / 2;
  const halfRad = (halfAngle * Math.PI) / 180;
  // In a unit circle, the wedge from -halfAngle to +halfAngle:
  // left point: (sin(-half), -cos(-half)) = (-sin(half), -cos(half))
  // right point: (sin(half), -cos(half))
  // tip at origin (0, 0), arc at radius 1
  const sx = Math.sin(halfRad);
  const cy = Math.cos(halfRad);
  // Scale to viewBox 100x100 where origin is at (50, 100) — bottom center
  const R = 100; // radius in viewBox units
  const ox = 50; // origin x
  const oy = 100; // origin y (bottom)
  const x1 = ox - sx * R;
  const y1 = oy - cy * R;
  const x2 = ox + sx * R;
  const y2 = oy - cy * R;
  const largeArc = sectorDeg > 180 ? 1 : 0;

  const wedgePath = `M ${ox} ${oy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

  sectors.forEach((sector, i) => {
    const $slice = document.createElement('div');
    $slice.className = 'spin-wheel-sector';
    $slice.style.rotate = `${i * sectorDeg}deg`;

    $slice.innerHTML = `
      <svg class="spin-wheel-sector-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="${wedgePath}" fill="${sector.color}" stroke="rgba(255,255,255,0.35)" stroke-width="0.5" />
      </svg>
      <div class="spin-wheel-sector-label">
        <span class="spin-wheel-label-emoji">${sector.emoji}</span>
        <span class="spin-wheel-label-value">${sector.label}</span>
      </div>
    `;

    $wheelRotor.appendChild($slice);
  });

  console.log(`🎰 wheel built: ${count} sectors`);
}

// ===== Spin Logic =====
function spin() {
  if (spinning) return;
  spinning = true;
  $btnSpin.disabled = true;
  $spinResult.hidden = true;

  const count = SECTORS.length;
  const sectorDeg = 360 / count;

  // pick random winner
  const winnerIndex = Math.floor(Math.random() * count);
  const sector = SECTORS[winnerIndex];

  // CSS rotate(D) spins clockwise. Arrow is at top (0°).
  // Sector i is centered at i*sectorDeg (wedge is symmetric ±halfAngle).
  // To land on sector i: D%360 = 360 - (i*sectorDeg + offset).
  // offset ∈ [-sectorDeg/2 + padding, sectorDeg/2 - padding] to stay within the sector.
  const padding = sectorDeg * 0.15;
  const halfSector = sectorDeg / 2;
  const safeRange = halfSector - padding; // max offset from center
  // offset distribution: controls where the arrow lands within a sector
  // ** 0.5 — soft bias toward edges (current)
  // ** 0.3 — stronger bias toward edges
  // ** 1   — uniform (no bias)
  // alt: 1 - Math.abs(Math.random() - Math.random()) — U-shape via triangle diff
  const t = Math.random() ** 0.5;
  const sign = Math.random() < 0.5 ? -1 : 1;
  const offset = sign * t * safeRange;
  const targetMod = (360 - (winnerIndex * sectorDeg + offset) + 360) % 360;

  // add 3-5 full spins
  const fullSpins = 360 * (3 + Math.floor(Math.random() * 3));
  const currentMod = currentRotationDeg % 360;
  const delta = fullSpins + ((targetMod - currentMod + 360) % 360);

  currentRotationDeg += delta;

  animateSpin(currentRotationDeg - delta, delta, () => {
    spinning = false;
    $btnSpin.disabled = false;
    showResult(sector);
    console.log(`🎰 result: ${sector.emoji} ${sector.label}`);
  });
}

// ===== Show Result =====
function showResult(sector) {
  $spinResultEmoji.textContent = sector.emoji;
  $spinResultText.textContent = sector.label;
  $spinResult.hidden = false;

  setTimeout(() => {
    $spinResult.hidden = true;
  }, 2500);
}

// ===== Init =====
function init() {
  buildWheel(SECTORS);
  bindEvents();
  console.log('🎰 spin wheel ready');
}

function bindEvents() {
  $btnSpin.addEventListener('click', spin);
  $spinResult.addEventListener('click', () => {
    $spinResult.hidden = true;
  });
}

init();
