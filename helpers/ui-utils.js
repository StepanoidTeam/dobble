import { SeededRandom, cardToSeed } from './seeded-random.js';
import { DEFAULT_ICON_ROTATION_DEGREES } from '../settings.js';
import { getEmojiImageUrl } from '../emojis/emoji-images.js';

// ===== Avatar Rendering =====
export function renderAvatarHtml(emoji, useCustomImages = false) {
  if (useCustomImages && emoji) {
    const url = getEmojiImageUrl(emoji, 'classic');
    if (url) return `<img class="avatar-img" src="${url}" alt="${emoji}">`;
  }
  return `<span class="avatar-emoji">${emoji || '👤'}</span>`;
}

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

export function updateRingProgress(ringElements, remaining) {
  const clampedRemaining = Math.max(0, Math.min(1, remaining));
  const segmentLength = clampedRemaining * 50;
  const config = {
    firstStart: 0,
    secondStart: 50,
    firstLength: segmentLength,
    secondLength: segmentLength,
  };

  // todo(vmyshko): this is performance heavy for chrome devtools
  return; //debug
  if (Array.isArray(ringElements)) {
    ringElements.forEach((ringEl) => setCardRingSegments(ringEl, config));
  } else if (ringElements) {
    setCardRingSegments(ringElements, config);
  }
}

// ===== Position emojis in a circle layout =====

// Base emoji diameter as % of container (mirrors --emoji-size = card-size * 0.1625)
const BASE_EMOJI_DIAMETER = 16.25;
const BASE_EMOJI_RADIUS = BASE_EMOJI_DIAMETER / 2;
const CARD_CIRCLE_RADIUS = 42.5; // card-circle is 85% of container → radius 42.5%
const RING_RADIUS = 30; // % from center for ring emojis
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.5;
const SCALE_PADDING = 1.5; // % gap between emoji circles

function computeEmojiPositions(count) {
  const hasCenter = count > 3;
  const ringCount = hasCenter ? count - 1 : count;
  const radius = hasCenter ? RING_RADIUS : RING_RADIUS * 0.7;

  return Array.from({ length: count }, (_, i) => {
    if (hasCenter && i === count - 1) return { x: 50, y: 50, angleDeg: 0 };

    const angle = (i / ringCount) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
      angleDeg: (angle * 180) / Math.PI - 90,
    };
  });
}

// Greedy sequential: first emojis claim max scale, later ones fit around them
function computeGreedyScales(positions) {
  const scales = new Array(positions.length);

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    let maxAllowed = MAX_SCALE;

    // card circle boundary
    const distFromCenter = Math.sqrt((pos.x - 50) ** 2 + (pos.y - 50) ** 2);
    const scaleFromBounds =
      (CARD_CIRCLE_RADIUS - distFromCenter - SCALE_PADDING) / BASE_EMOJI_RADIUS;
    maxAllowed = Math.min(maxAllowed, scaleFromBounds);

    // already-placed emojis
    for (let j = 0; j < i; j++) {
      const dx = pos.x - positions[j].x;
      const dy = pos.y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // available space = dist minus the already-claimed radius of j
      const available = dist - scales[j] * BASE_EMOJI_RADIUS - SCALE_PADDING;
      maxAllowed = Math.min(maxAllowed, available / BASE_EMOJI_RADIUS);
    }

    // not-yet-placed emojis (assume symmetric MIN_SCALE for them)
    for (let j = i + 1; j < positions.length; j++) {
      const dx = pos.x - positions[j].x;
      const dy = pos.y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const available = dist - MIN_SCALE * BASE_EMOJI_RADIUS - SCALE_PADDING;
      maxAllowed = Math.min(maxAllowed, available / BASE_EMOJI_RADIUS);
    }

    scales[i] = Math.max(MIN_SCALE, maxAllowed);
  }

  return scales;
}

export function positionEmojis(
  card,
  containerEl,
  isClickable,
  onSymbolClick,
  layoutOptions = {},
) {
  containerEl.innerHTML = '';

  const seed = layoutOptions.seed ?? cardToSeed(card);
  const rng = new SeededRandom(seed);

  const shuffledCard = rng.shuffle(card);
  const count = shuffledCard.length;
  const rotationRangeDegrees =
    typeof layoutOptions.rotationRangeDegrees === 'number'
      ? layoutOptions.rotationRangeDegrees
      : DEFAULT_ICON_ROTATION_DEGREES;
  const rotateByPosition = layoutOptions.rotateByPosition === true;
  const useCustomEmojiImages = layoutOptions.useCustomEmojiImages !== false;
  const emojiSetKey = layoutOptions.emojiSetKey;

  const positions = computeEmojiPositions(count);
  const maxScales = computeGreedyScales(positions);

  shuffledCard.forEach((symbol, i) => {
    const $el = document.createElement('div');
    $el.classList.add('emoji-item');
    $el.dataset.symbol = symbol;

    const imageUrl = useCustomEmojiImages
      ? getEmojiImageUrl(symbol, emojiSetKey)
      : null;
    if (imageUrl) {
      const $img = document.createElement('img');
      $img.src = imageUrl;
      $img.alt = symbol;
      $img.draggable = false;
      $img.onerror = () => {
        $el.removeChild($img);
        $el.textContent = symbol;
      };
      $el.appendChild($img);
    } else {
      $el.textContent = symbol;
    }

    const { x, y, angleDeg } = positions[i];
    $el.style.left = `${roundUiNumber(x)}%`;
    $el.style.top = `${roundUiNumber(y)}%`;

    // Scale within safe bounds to avoid overlap
    const safeMax = maxScales[i];
    const sizeVariation = MIN_SCALE + rng.random() * (safeMax - MIN_SCALE);

    const jitter =
      rotationRangeDegrees === 0
        ? 0
        : -rotationRangeDegrees / 2 + rng.random() * rotationRangeDegrees;
    const rotation =
      i === 0 ? jitter : (rotateByPosition ? angleDeg : 0) + jitter;
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
