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

// ===== DOM Refs =====
const $rotor = $wheelRotor;
const $btn = $btnSpin;
const $arrow = $wheelArrow;
const $result = $spinResult;
const $resultEmoji = $spinResultEmoji;
const $resultText = $spinResultText;

// ===== Build Wheel =====
function buildWheel(sectors) {
  const count = sectors.length;
  const sectorDeg = 360 / count;
  const sectorRad = (sectorDeg * Math.PI) / 180;

  $rotor.innerHTML = '';

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

    $rotor.appendChild($slice);
  });

  console.log(`🎰 wheel built: ${count} sectors`);
}

// ===== Spin Logic =====
function spin() {
  if (spinning) return;
  spinning = true;
  $btn.disabled = true;
  $result.hidden = true;

  const count = SECTORS.length;
  const sectorDeg = 360 / count;

  // pick random winner
  const winnerIndex = Math.floor(Math.random() * count);
  const sector = SECTORS[winnerIndex];

  // CSS rotate(D) spins clockwise. Arrow is at top (0°).
  // Sector i starts at i*sectorDeg. We need D%360 = 360 - (i*sectorDeg + offset).
  const padding = sectorDeg * 0.1;
  const offset = padding + Math.random() * (sectorDeg - 2 * padding);
  const targetMod = (360 - (winnerIndex * sectorDeg + offset) + 360) % 360;

  // add 3-5 full spins
  const fullSpins = 360 * (3 + Math.floor(Math.random() * 3));
  const currentMod = currentRotationDeg % 360;
  const delta = fullSpins + ((targetMod - currentMod + 360) % 360);

  currentRotationDeg += delta;
  $rotor.style.transform = `rotate(${currentRotationDeg}deg)`;

  console.log(
    `🎰 spinning → sector ${winnerIndex}: ${sector.emoji} ${sector.label}`,
  );

  // wait for CSS transition to end
  const onEnd = () => {
    $rotor.removeEventListener('transitionend', onEnd);
    spinning = false;
    $btn.disabled = false;
    showResult(sector);
    console.log(`🎰 result: ${sector.emoji} ${sector.label}`);
  };
  $rotor.addEventListener('transitionend', onEnd);
}

// ===== Show Result =====
function showResult(sector) {
  $resultEmoji.textContent = sector.emoji;
  $resultText.textContent = sector.label;
  $result.hidden = false;

  setTimeout(() => {
    $result.hidden = true;
  }, 2500);
}

// ===== Init =====
function init() {
  buildWheel(SECTORS);
  bindEvents();
  console.log('🎰 spin wheel ready');
}

function bindEvents() {
  $btn.addEventListener('click', spin);
  $result.addEventListener('click', () => {
    $result.hidden = true;
  });
}

init();
