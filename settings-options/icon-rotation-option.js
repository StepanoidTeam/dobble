import {
  ICON_ROTATION_STORAGE_KEY,
  ICON_ROTATION_MIN_DEGREES,
  ICON_ROTATION_MAX_DEGREES,
  ICON_ROTATION_STEP_DEGREES,
  snapIconRotationDegrees,
} from '../settings.js';
import { updateRangeProgress } from '../ui-utils.js';

const $control = $rotationRange;

export const iconRotationOption = {
  init(game) {
    const rawValue = localStorage.getItem(ICON_ROTATION_STORAGE_KEY);
    const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
    if (Number.isNaN(parsedValue)) return;

    game.iconRotationDegrees = snapIconRotationDegrees(parsedValue);
  },

  syncControl(game) {
    if ($control) {
      $control.min = `${ICON_ROTATION_MIN_DEGREES}`;
      $control.max = `${ICON_ROTATION_MAX_DEGREES}`;
      $control.step = `${ICON_ROTATION_STEP_DEGREES}`;
      $control.value = `${game.iconRotationDegrees}`;
      updateRangeProgress($control);
    }

    game.updateRotationDisplay(game.iconRotationDegrees);
  },

  bindEvents(game) {
    if (!$control) return;

    $control.addEventListener('input', (e) => {
      updateRangeProgress(e.target);
      const nextValue = parseInt(e.target.value, 10);
      if (Number.isNaN(nextValue)) return;
      game.applyIconRotationDegrees(nextValue);
      localStorage.setItem(
        ICON_ROTATION_STORAGE_KEY,
        `${game.iconRotationDegrees}`,
      );
    });
  },
};
