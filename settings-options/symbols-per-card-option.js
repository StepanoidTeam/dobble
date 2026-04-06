import {
  SYMBOLS_PER_CARD_STORAGE_KEY,
  SYMBOLS_PER_CARD_MIN,
} from '../settings.js';
import {
  getValidOrders,
  symbolsPerCardForOrder,
} from '../helpers/dobble-math.js';

const $control = $symbolsPerCardRange;

export const symbolsPerCardOption = {
  init(game) {
    const rawValue = localStorage.getItem(SYMBOLS_PER_CARD_STORAGE_KEY);
    const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
    if (Number.isNaN(parsedValue) || parsedValue < 2) return;

    game.symbolsPerCardOrder = parsedValue;
  },

  syncControl(game) {
    if (!$control) return;

    const orders = getValidOrders(game.getCurrentSymbols().length);
    const maxSymbolsPerCard = orders.length
      ? orders[orders.length - 1].symbolsPerCard
      : SYMBOLS_PER_CARD_MIN;
    const minSymbolsPerCard = orders.length
      ? orders[0].symbolsPerCard
      : SYMBOLS_PER_CARD_MIN;

    $control.min = `${minSymbolsPerCard}`;
    $control.max = `${maxSymbolsPerCard}`;
    $control.step = '1';

    // Clamp stored order to valid range
    const effectiveN = game.getEffectiveOrder();
    $control.value = `${symbolsPerCardForOrder(effectiveN)}`;

    game.updateSymbolsPerCardDisplay(effectiveN);
  },

  bindEvents(game) {
    if (!$control) return;

    $control.addEventListener('input', (e) => {
      const symbolsPerCard = parseInt(e.target.value, 10);
      if (Number.isNaN(symbolsPerCard)) return;

      const n = symbolsPerCard - 1;
      game.symbolsPerCardOrder = n;
      game.updateSymbolsPerCardDisplay(n);
      game.renderPreviewCard();
      localStorage.setItem(SYMBOLS_PER_CARD_STORAGE_KEY, `${n}`);
    });
  },
};
