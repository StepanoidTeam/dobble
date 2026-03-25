import { CUSTOM_EMOJI_RENDER_STORAGE_KEY } from '../settings.js';

const $control = $toggleCustomEmojiRender;

export const customEmojiRenderOption = {
  init(game) {
    const saved = localStorage.getItem(CUSTOM_EMOJI_RENDER_STORAGE_KEY);
    game.useCustomEmojiRender = saved !== 'false';
  },

  syncControl(game) {
    if (!$control) return;
    $control.checked = game.useCustomEmojiRender;
  },

  bindEvents(game) {
    if (!$control) return;

    $control.addEventListener('change', (e) => {
      game.useCustomEmojiRender = e.target.checked;
      localStorage.setItem(
        CUSTOM_EMOJI_RENDER_STORAGE_KEY,
        `${game.useCustomEmojiRender}`,
      );
      game.renderPreviewCard();
    });
  },
};
