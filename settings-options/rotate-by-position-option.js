import { ROTATE_BY_POSITION_STORAGE_KEY } from '../settings.js';

const $control = $toggleRotateByPosition;

export const rotateByPositionOption = {
  init(game) {
    const saved = localStorage.getItem(ROTATE_BY_POSITION_STORAGE_KEY);
    game.rotateByPosition = saved === 'true';
  },

  syncControl(game) {
    if (!$control) return;
    $control.checked = game.rotateByPosition;
  },

  bindEvents(game) {
    if (!$control) return;

    $control.addEventListener('change', (e) => {
      game.rotateByPosition = e.target.checked;
      localStorage.setItem(
        ROTATE_BY_POSITION_STORAGE_KEY,
        `${game.rotateByPosition}`,
      );
      game.renderPreviewCard();
    });
  },
};
