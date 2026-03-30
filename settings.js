import { EMOJIS_CLAUDE } from './emojis-claude.js';
import { EMOJIS_CLASSIC } from './emojis-classic.js';
import { EMOJIS_INSECTS } from './emojis-insects.js';

// ===== Storage Keys =====
export const EMOJI_SET_STORAGE_KEY = 'dobble_emoji_set';
export const TIME_PER_CARD_STORAGE_KEY = 'dobble_time_per_card_ms';
export const ICON_ROTATION_STORAGE_KEY = 'dobble_icon_rotation_deg';
export const ROTATE_BY_POSITION_STORAGE_KEY = 'dobble_rotate_by_position';
export const CUSTOM_EMOJI_RENDER_STORAGE_KEY = 'dobble_custom_emoji_render';

// ===== Timer =====
export const TIME_PER_CARD_MIN_SECONDS = 5;
export const TIME_PER_CARD_MAX_SECONDS = 100;
export const TIME_PER_CARD_STEP_SECONDS = 5;
export const DEFAULT_TIME_PER_CARD_MS = 10000;

// ===== Icon Rotation =====
export const ICON_ROTATION_MIN_DEGREES = 0;
export const ICON_ROTATION_MAX_DEGREES = 360;
export const ICON_ROTATION_STEP_DEGREES = 5;
export const DEFAULT_ICON_ROTATION_DEGREES = 40;

// ===== Emoji Sets =====
export const EMOJI_SETS = [
  {
    key: 'origin',
    label: `${EMOJIS_CLASSIC.at(0)}Классический`,
    symbols: EMOJIS_CLASSIC,
  },
  {
    key: 'base',
    label: `${EMOJIS_CLAUDE.at(0)}Базовый`,
    symbols: EMOJIS_CLAUDE,
  },
  {
    key: 'insects',
    label: `${EMOJIS_INSECTS.at(0)}Насекомые`,
    symbols: EMOJIS_INSECTS,
  },
];

// ===== Snap Helpers =====
function snapToStep(value, min, max, step) {
  const clamped = Math.max(min, Math.min(max, value));
  const steps = Math.round((clamped - min) / step);
  return min + steps * step;
}

export function snapTimerSeconds(seconds) {
  return snapToStep(
    seconds,
    TIME_PER_CARD_MIN_SECONDS,
    TIME_PER_CARD_MAX_SECONDS,
    TIME_PER_CARD_STEP_SECONDS,
  );
}

export function snapIconRotationDegrees(degrees) {
  return snapToStep(
    degrees,
    ICON_ROTATION_MIN_DEGREES,
    ICON_ROTATION_MAX_DEGREES,
    ICON_ROTATION_STEP_DEGREES,
  );
}
