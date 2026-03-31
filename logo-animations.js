// ===== Logo Icon Animations (Web Animations API) =====

import { Random } from './seeded-random.js';

const EFFECTS = {
  sepia: {
    keyframes: [
      { filter: 'sepia(0)' },
      { filter: 'sepia(1)' },
      { filter: 'sepia(0)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  blur: {
    keyframes: [
      { filter: 'blur(0px)' },
      { filter: 'blur(0px)' },
      { filter: 'blur(3px)' },
      { filter: 'blur(0px)' },
      { filter: 'blur(0px)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  invert: {
    keyframes: [
      { filter: 'invert(0)' },
      { filter: 'invert(0)' },
      { filter: 'invert(1)' },
      { filter: 'invert(1)' },
      { filter: 'invert(0)' },
      { filter: 'invert(0)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  opacity: {
    keyframes: [{ filter: 'opacity(1)' }, { filter: 'opacity(0.1)' }],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  saturate: {
    keyframes: [
      { filter: 'saturate(1)' },
      { filter: 'saturate(1)' },
      { filter: 'saturate(5)' },
      { filter: 'saturate(1)' },
      { filter: 'saturate(1)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  bright: {
    keyframes: [
      { filter: 'brightness(0.5)' },
      { filter: 'brightness(0.9)', offset: 0.2 },
      { filter: 'brightness(1.1)', offset: 0.9 },
      { filter: 'brightness(3)' },
      { filter: 'brightness(1)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  acid: {
    keyframes: [
      { filter: 'hue-rotate(0deg)' },
      { filter: 'hue-rotate(360deg)' },
    ],
    options: { duration: 5000, easing: 'ease-in-out' },
  },
  bubble: {
    keyframes: [{ scale: 1.1 }, { scale: 0.9 }],
    options: { duration: 3000, easing: 'ease-in-out', direction: 'alternate' },
    applyStyle($el) {
      $el.style.padding = '15px';
      $el.style.borderRadius = '90px';
      $el.style.backgroundColor = '#ffffff33';
      $el.style.border = '3px solid var(--bg-primary)';
      $el.style.boxShadow = 'inset 0 0 3px 3px var(--ring-purple)';
      $el.style.backdropFilter = 'blur(1px)';
    },
    removeStyle($el) {
      $el.style.padding = '';
      $el.style.borderRadius = '';
      $el.style.backgroundColor = '';
      $el.style.border = '';
      $el.style.boxShadow = '';
      $el.style.backdropFilter = '';
    },
  },
};

const effectNames = Object.keys(EFFECTS);
let currentEffect = null;
let currentAnimation = null;
let autoPlayTimer = null;

// ===== Easter Egg =====
const EASTER_EGG_CLICKS = 10;
const EASTER_EGG_WINDOW_MS = 3000;
const ORIGINAL_SRC = './images/favicon.png';
const EASTER_SRC = './images/logo-easter-ff.png';
let clickTimestamps = [];
let easterEggActive = false;

function checkEasterEgg($logoIcon) {
  const now = Date.now();
  clickTimestamps.push(now);
  clickTimestamps = clickTimestamps.filter(
    (t) => now - t < EASTER_EGG_WINDOW_MS,
  );

  if (clickTimestamps.length >= EASTER_EGG_CLICKS && !easterEggActive) {
    easterEggActive = true;
    $logoIcon.src = EASTER_SRC;
    console.log('🥚 easter egg activated!');
  }
}

export function resetEasterEgg($logoIcon) {
  if (easterEggActive) {
    easterEggActive = false;
    $logoIcon.src = ORIGINAL_SRC;
    clickTimestamps = [];
  }
}

const AUTO_PLAY_MIN_MS = 8000;
const AUTO_PLAY_MAX_MS = 15000;

function scheduleAutoPlay($logoIcon, $logoContainer) {
  clearTimeout(autoPlayTimer);
  const delay =
    AUTO_PLAY_MIN_MS + Math.random() * (AUTO_PLAY_MAX_MS - AUTO_PLAY_MIN_MS);
  autoPlayTimer = setTimeout(() => {
    playLogoEffect($logoIcon);
    // playLogoPress($logoContainer);
    scheduleAutoPlay($logoIcon, $logoContainer);
  }, delay);
}

export function startAutoPlay($logoIcon, $logoContainer) {
  scheduleAutoPlay($logoIcon, $logoContainer);
}

export function stopAutoPlay() {
  clearTimeout(autoPlayTimer);
  autoPlayTimer = null;
}

export function playLogoEffect($logoIcon, { fromClick = false } = {}) {
  // Check easter egg on manual clicks
  if (fromClick) checkEasterEgg($logoIcon);

  // After easter egg, ignore manual clicks
  if (fromClick && easterEggActive) return;

  // Cancel previous animation
  if (currentAnimation) {
    currentAnimation.cancel();
    currentAnimation = null;
  }

  // Remove bubble styling if it was active
  if (currentEffect === 'bubble') {
    EFFECTS.bubble.removeStyle($logoIcon);
  }

  // Reset inline filter so it doesn't stick
  $logoIcon.style.filter = '';

  // Pick a new random effect (different from current)
  currentEffect = Random.sample(effectNames.filter((e) => e !== currentEffect));

  const effect = EFFECTS[currentEffect];

  // Apply special styling (bubble)
  if (effect.applyStyle) effect.applyStyle($logoIcon);

  currentAnimation = $logoIcon.animate(effect.keyframes, {
    ...effect.options,
    fill: 'forwards',
  });

  console.log('🖐️ logo effect:', currentEffect);
}

export function playLogoPress($logoContainer) {
  $logoContainer.animate(
    [{ scale: 1 }, { scale: 0.8, offset: 0.4 }, { scale: 1 }],
    { duration: 1000, easing: 'ease-out' },
  );
}
