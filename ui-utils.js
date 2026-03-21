import { shuffle } from './deck.js';
import { DEFAULT_ICON_ROTATION_DEGREES } from './settings.js';

export function roundUiNumber(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function setCardRingSegments(cardRingEl, config = {}) {
  if (!cardRingEl) return;

  const { strokeWidth, firstLength, firstStart, secondLength, secondStart } =
    config;

  if (typeof strokeWidth === 'number') {
    cardRingEl.style.setProperty(
      '--ring-stroke-width',
      `${roundUiNumber(strokeWidth)}`,
    );
  }
  if (typeof firstLength === 'number') {
    cardRingEl.style.setProperty(
      '--ring-segment-a-length',
      `${roundUiNumber(firstLength)}`,
    );
  }
  if (typeof firstStart === 'number') {
    cardRingEl.style.setProperty(
      '--ring-segment-a-start',
      `${roundUiNumber(firstStart)}`,
    );
  }
  if (typeof secondLength === 'number') {
    cardRingEl.style.setProperty(
      '--ring-segment-b-length',
      `${roundUiNumber(secondLength)}`,
    );
  }
  if (typeof secondStart === 'number') {
    cardRingEl.style.setProperty(
      '--ring-segment-b-start',
      `${roundUiNumber(secondStart)}`,
    );
  }
}

export function initCardRings() {
  const $$cardRings = document.querySelectorAll('.card-ring');
  $$cardRings.forEach(($cardRingEl, index) => {
    setCardRingSegments($cardRingEl, {
      firstLength: index === 0 ? 20 : 18,
      firstStart: 8,
      secondLength: index === 0 ? 16 : 18,
      secondStart: 58,
    });
  });
}

export function updateRangeProgress(rangeEl) {
  if (!rangeEl) return;

  const min = parseFloat(rangeEl.min || '0');
  const max = parseFloat(rangeEl.max || '100');
  const value = parseFloat(rangeEl.value || '0');
  const span = max - min;
  const progress = span <= 0 ? 0 : ((value - min) / span) * 100;
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const progressValue = `${roundUiNumber(normalizedProgress)}%`;

  rangeEl.dataset.width = `${roundUiNumber(normalizedProgress)}`;
  rangeEl.style.setProperty('--range-progress', progressValue);
}

export function updateRingProgress(ringElements, remaining) {
  const clampedRemaining = Math.max(0, Math.min(1, remaining));
  const segmentLength = clampedRemaining * 50;
  const config = {
    firstStart: 0,
    secondStart: 50,
    firstLength: segmentLength,
    secondLength: segmentLength,
  };

  return; //debug
  if (Array.isArray(ringElements)) {
    ringElements.forEach((ringEl) => setCardRingSegments(ringEl, config));
  } else if (ringElements) {
    setCardRingSegments(ringElements, config);
  }
}

// ===== Position emojis in a circle layout =====
export function positionEmojis(
  card,
  containerEl,
  isClickable,
  onSymbolClick,
  layoutOptions = {},
) {
  containerEl.innerHTML = '';

  const shuffledCard = shuffle(card);
  const count = shuffledCard.length;
  const rotationRangeDegrees =
    typeof layoutOptions.rotationRangeDegrees === 'number'
      ? layoutOptions.rotationRangeDegrees
      : DEFAULT_ICON_ROTATION_DEGREES;
  const rotateByPosition = layoutOptions.rotateByPosition === true;

  // Place one emoji in center, rest around
  shuffledCard.forEach((symbol, i) => {
    const $el = document.createElement('div');
    $el.classList.add('emoji-item');
    $el.textContent = symbol;
    $el.dataset.symbol = symbol;

    let x, y;
    let posAngleDeg = 0;
    if (i === 0) {
      x = 50;
      y = 50;
    } else {
      const angle = ((i - 1) / (count - 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 30; // % from center
      x = 50 + radius * Math.cos(angle);
      y = 50 + radius * Math.sin(angle);
      posAngleDeg = (angle * 180) / Math.PI - 90; // outward direction
    }

    $el.style.left = `${roundUiNumber(x)}%`;
    $el.style.top = `${roundUiNumber(y)}%`;

    // Size variation + rotation aligned to position with jitter
    const sizeVariation = 0.9 + Math.random() * 0.35;
    const jitter =
      rotationRangeDegrees === 0
        ? 0
        : -rotationRangeDegrees / 2 + Math.random() * rotationRangeDegrees;
    const rotation =
      i === 0 ? jitter : (rotateByPosition ? posAngleDeg : 0) + jitter;
    $el.style.scale = `${roundUiNumber(sizeVariation)}`;
    $el.style.rotate = `${roundUiNumber(rotation)}deg`;

    if (isClickable && onSymbolClick) {
      $el.addEventListener('click', (e) => {
        e.preventDefault();
        onSymbolClick(symbol, $el);
      });
    }

    containerEl.appendChild($el);
  });
}
