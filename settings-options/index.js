import { customEmojiRenderOption } from './custom-emoji-render-option.js';
import { rotateByPositionOption } from './rotate-by-position-option.js';
import { iconRotationOption } from './icon-rotation-option.js';

const OPTIONS = [
  customEmojiRenderOption,
  rotateByPositionOption,
  iconRotationOption,
];

export const SettingsOptionsManager = {
  init(game) {
    OPTIONS.forEach((option) => option.init?.(game));
  },

  syncControls(game) {
    OPTIONS.forEach((option) => option.syncControl?.(game));
  },

  bindEvents(game) {
    OPTIONS.forEach((option) => option.bindEvents?.(game));
  },
};
