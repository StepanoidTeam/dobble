// ===== Dobble Game Engine =====

import { ALL_SYMBOLS as BASE_SYMBOLS } from './emojis-claude.js';
import { ALL_SYMBOLS as ORIGIN_SYMBOLS } from './emojis-origin.js';
import { ALL_SYMBOLS as INSECT_SYMBOLS } from './emojis-insects.js';
import { getDeckStatsBySymbolsCount } from './dobble-math.js';
import { AudioManager } from './audio-manager.js';

const EMOJI_SET_STORAGE_KEY = 'dobble_emoji_set';
const TIME_PER_CARD_STORAGE_KEY = 'dobble_time_per_card_ms';
const ICON_ROTATION_STORAGE_KEY = 'dobble_icon_rotation_deg';
const TIME_PER_CARD_MIN_SECONDS = 5;
const TIME_PER_CARD_MAX_SECONDS = 100;
const TIME_PER_CARD_STEP_SECONDS = 5;
const DEFAULT_TIME_PER_CARD_MS = 10000;
const ICON_ROTATION_MIN_DEGREES = 0;
const ICON_ROTATION_MAX_DEGREES = 360;
const ICON_ROTATION_STEP_DEGREES = 5;
const DEFAULT_ICON_ROTATION_DEGREES = 40;
const EMOJI_SETS = [
  {
    key: 'base',
    label: `${BASE_SYMBOLS.at(0)}Базовый`,
    symbols: BASE_SYMBOLS,
  },
  {
    key: 'origin',
    label: `${ORIGIN_SYMBOLS.at(0)}Классический`,
    symbols: ORIGIN_SYMBOLS,
  },
  {
    key: 'insects',
    label: `${INSECT_SYMBOLS.at(0)}Насекомые`,
    symbols: INSECT_SYMBOLS,
  },
];

// ===== Symbol Pool (emojis) =====

// ===== Dobble Card Generation =====
// Dobble uses a projective plane of order n.
// For valid n: total symbols/cards = n^2 + n + 1, symbols/card = n + 1.
// n is derived from the active emoji set size...

function generateDobbleCards(order) {
  const n = order;
  const cards = [];

  // Generate cards using projective plane construction
  // Card 0: symbols 0..n
  const card0 = [];
  for (let i = 0; i <= n; i++) card0.push(i);
  cards.push(card0);

  // Cards 1..n: for each i in [0, n-1]
  for (let i = 0; i < n; i++) {
    const card = [0]; // always include symbol 0
    for (let j = 0; j < n; j++) {
      card.push(n + 1 + i * n + j);
    }
    cards.push(card);
  }

  // Cards n+1 .. n^2+n: for each i in [0, n-1], j in [0, n-1]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const card = [i + 1]; // one of the symbols from card 0
      for (let k = 0; k < n; k++) {
        card.push(n + 1 + k * n + ((i * k + j) % n));
      }
      cards.push(card);
    }
  }

  return cards;
}

// Build deck with actual emoji symbols
function buildDeck(symbols) {
  const sourceSymbols = Array.isArray(symbols) ? symbols : [];
  const stats = getDeckStatsBySymbolsCount(sourceSymbols.length);

  console.log('🃏stats', stats);

  if (!stats) {
    return {
      deck: [],
      stats: null,
    };
  }

  const cards = generateDobbleCards(stats.n);
  const safeSymbols = sourceSymbols.slice(0, stats.totalSymbolsUsed);

  // Map indices to emojis
  return {
    deck: cards.map((card) => card.map((idx) => safeSymbols[idx])),
    stats,
  };
}

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Find the common symbol between two cards
function findCommonSymbol(card1, card2) {
  for (const sym of card1) {
    if (card2.includes(sym)) return sym;
  }
  return null;
}

function roundUiNumber(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function setCardRingSegments(cardRingEl, config = {}) {
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

function initCardRings() {
  const cardRings = document.querySelectorAll('.card-ring');
  cardRings.forEach((cardRingEl, index) => {
    setCardRingSegments(cardRingEl, {
      firstLength: index === 0 ? 20 : 18,
      firstStart: 8,
      secondLength: index === 0 ? 16 : 18,
      secondStart: 58,
    });
  });

  window.setCardRingSegments = setCardRingSegments;
}

function snapTimerSeconds(seconds) {
  const clamped = Math.max(
    TIME_PER_CARD_MIN_SECONDS,
    Math.min(TIME_PER_CARD_MAX_SECONDS, seconds),
  );
  const steps = Math.round(
    (clamped - TIME_PER_CARD_MIN_SECONDS) / TIME_PER_CARD_STEP_SECONDS,
  );
  return TIME_PER_CARD_MIN_SECONDS + steps * TIME_PER_CARD_STEP_SECONDS;
}

function snapIconRotationDegrees(degrees) {
  const clamped = Math.max(
    ICON_ROTATION_MIN_DEGREES,
    Math.min(ICON_ROTATION_MAX_DEGREES, degrees),
  );
  const steps = Math.round(clamped / ICON_ROTATION_STEP_DEGREES);
  return steps * ICON_ROTATION_STEP_DEGREES;
}

function updateRangeProgress(rangeEl) {
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

// ===== Position emojis in a circle layout =====
function positionEmojis(
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

  // Place one emoji in center, rest around
  shuffledCard.forEach((symbol, i) => {
    const el = document.createElement('div');
    el.classList.add('emoji-item');
    el.textContent = symbol;
    el.dataset.symbol = symbol;

    let x, y;
    if (i === 0) {
      // Center
      x = 50;
      y = 50;
    } else {
      // Distribute around circle
      const angle = ((i - 1) / (count - 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 30; // % from center
      x = 50 + radius * Math.cos(angle);
      y = 50 + radius * Math.sin(angle);
    }

    el.style.left = `${roundUiNumber(x)}%`;
    el.style.top = `${roundUiNumber(y)}%`;

    // Random slight size variation and rotation
    const sizeVariation = 0.9 + Math.random() * 0.35;
    const rotation =
      rotationRangeDegrees === 0
        ? 0
        : -rotationRangeDegrees / 2 + Math.random() * rotationRangeDegrees;
    el.style.scale = `${roundUiNumber(sizeVariation)}`;
    el.style.rotate = `${roundUiNumber(rotation)}deg`;

    if (isClickable && onSymbolClick) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        onSymbolClick(symbol, el);
      });
    }

    containerEl.appendChild(el);
  });
}

// ===== Game State =====
const Game = {
  deck: [],
  selectedEmojiSetKey: EMOJI_SETS.at(0).key,
  currentCardIndex: 0,
  topCard: null,
  bottomCard: null,
  score: 0,
  startTime: 0,
  timerInterval: null,
  previewTimerInterval: null,
  timePerCard: DEFAULT_TIME_PER_CARD_MS,
  iconRotationDegrees: DEFAULT_ICON_ROTATION_DEGREES,
  cardStartTime: 0,
  previewCardStartTime: 0,
  pausedCardElapsed: 0,
  gameCardRings: [],
  previewCardRing: null,
  isPlaying: false,
  isInputLocked: false,
  totalCardsInGame: 20, // number of card pairs to play

  init() {
    this.loadEmojiSetPreference();
    this.loadTimerPreference();
    this.loadIconRotationPreference();
    this.populateEmojiSetOptions();
    this.syncSettingsControls();
    this.bindEvents();
    AudioManager.init();
    this.createFlashOverlay();
    this.cacheGameCardRings();
    this.cachePreviewCardRing();
    this.renderPreviewCard();
    this.startPreviewCycle();
    this.updateCardsRemaining();
    this.updateElapsedTime();
  },

  cacheGameCardRings() {
    this.gameCardRings = Array.from(
      document.querySelectorAll(
        '.card-top .card-ring, .card-bottom .card-ring',
      ),
    );
  },

  cachePreviewCardRing() {
    this.previewCardRing = document.querySelector('.card-preview .card-ring');
  },

  populateEmojiSetOptions() {
    if (!emojiSetSelect) return;

    emojiSetSelect.innerHTML = '';
    EMOJI_SETS.forEach((setConfig) => {
      const option = document.createElement('option');
      option.value = setConfig.key;
      option.textContent = setConfig.label;
      emojiSetSelect.appendChild(option);
    });

    emojiSetSelect.value = this.selectedEmojiSetKey;
  },

  loadEmojiSetPreference() {
    const savedSetKey = localStorage.getItem(EMOJI_SET_STORAGE_KEY);
    if (savedSetKey && EMOJI_SETS.find((x) => x.key === savedSetKey)) {
      this.selectedEmojiSetKey = savedSetKey;
    }
  },

  loadTimerPreference() {
    const rawValue = localStorage.getItem(TIME_PER_CARD_STORAGE_KEY);
    const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
    if (Number.isNaN(parsedValue)) return;

    const normalizedSeconds = snapTimerSeconds(Math.round(parsedValue / 1000));
    this.timePerCard = normalizedSeconds * 1000;
  },

  loadIconRotationPreference() {
    const rawValue = localStorage.getItem(ICON_ROTATION_STORAGE_KEY);
    const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
    if (Number.isNaN(parsedValue)) return;

    this.iconRotationDegrees = snapIconRotationDegrees(parsedValue);
  },

  getTimePerCardSeconds() {
    return Math.round(this.timePerCard / 1000);
  },

  applyTimePerCardSeconds(seconds) {
    const snappedSeconds = snapTimerSeconds(seconds);
    this.timePerCard = snappedSeconds * 1000;
    localStorage.setItem(TIME_PER_CARD_STORAGE_KEY, `${this.timePerCard}`);
    this.updateTimerDisplay(snappedSeconds);
    if (timerRange) {
      timerRange.value = `${snappedSeconds}`;
      updateRangeProgress(timerRange);
    }
    if (screenStart.classList.contains('active')) {
      this.startPreviewCycle();
    }
  },

  applyIconRotationDegrees(degrees) {
    const snappedDegrees = snapIconRotationDegrees(degrees);
    this.iconRotationDegrees = snappedDegrees;
    localStorage.setItem(
      ICON_ROTATION_STORAGE_KEY,
      `${this.iconRotationDegrees}`,
    );
    this.updateRotationDisplay(snappedDegrees);
    if (rotationRange) {
      rotationRange.value = `${snappedDegrees}`;
      updateRangeProgress(rotationRange);
    }
    this.renderPreviewCard();
  },

  updateTimerDisplay(seconds) {
    if (!timerValue) return;
    timerValue.textContent = `${seconds} с`;
  },

  updateRotationDisplay(degrees) {
    if (!rotationValue) return;
    rotationValue.textContent = `${degrees}°`;
  },

  syncSettingsControls() {
    if (toggleSound) {
      toggleSound.checked = AudioManager.enabled;
    }

    if (timerRange) {
      timerRange.min = `${TIME_PER_CARD_MIN_SECONDS}`;
      timerRange.max = `${TIME_PER_CARD_MAX_SECONDS}`;
      timerRange.step = `${TIME_PER_CARD_STEP_SECONDS}`;
      timerRange.value = `${this.getTimePerCardSeconds()}`;
      updateRangeProgress(timerRange);
    }

    if (rotationRange) {
      rotationRange.min = `${ICON_ROTATION_MIN_DEGREES}`;
      rotationRange.max = `${ICON_ROTATION_MAX_DEGREES}`;
      rotationRange.step = `${ICON_ROTATION_STEP_DEGREES}`;
      rotationRange.value = `${this.iconRotationDegrees}`;
      updateRangeProgress(rotationRange);
    }

    this.updateTimerDisplay(this.getTimePerCardSeconds());
    this.updateRotationDisplay(this.iconRotationDegrees);
  },

  getCurrentSymbols() {
    const setConfig =
      EMOJI_SETS.find((x) => x.key === this.selectedEmojiSetKey) ||
      EMOJI_SETS.at(0);
    return setConfig.symbols;
  },

  getCurrentDeckStats() {
    const stats = getDeckStatsBySymbolsCount(this.getCurrentSymbols().length);
    console.log('🃏stats', stats);
    return stats;
  },

  bindEvents() {
    btnPlay.addEventListener('click', () => this.startGame());
    btnHowTo.addEventListener('click', () => this.showScreen(screenHowTo));
    btnOpenSettings.addEventListener('click', () => this.openSettings());
    btnBackHowTo.addEventListener('click', () => this.showScreen(screenStart));
    btnExitGame.addEventListener('click', () => this.openExitConfirm());
    btnSound.addEventListener('click', () => this.toggleSound());
    btnCloseSettings.addEventListener('click', () =>
      this.showScreen(screenStart),
    );
    btnContinueGame.addEventListener('click', () =>
      this.continueAfterConfirm(),
    );
    btnConfirmExit.addEventListener('click', () => this.quitGame());
    btnPlayAgain.addEventListener('click', () => this.startGame());
    btnMenu.addEventListener('click', () => this.quitGame());

    toggleSound.addEventListener('change', (e) => {
      AudioManager.enabled = e.target.checked;
      this.updateSoundIcon();
    });

    if (timerRange) {
      timerRange.addEventListener('input', (e) => {
        updateRangeProgress(e.target);
        const nextValue = parseInt(e.target.value, 10);
        if (Number.isNaN(nextValue)) return;
        this.applyTimePerCardSeconds(nextValue);
      });
    }

    if (rotationRange) {
      rotationRange.addEventListener('input', (e) => {
        updateRangeProgress(e.target);
        const nextValue = parseInt(e.target.value, 10);
        if (Number.isNaN(nextValue)) return;
        this.applyIconRotationDegrees(nextValue);
      });
    }

    if (!emojiSetSelect) return;

    emojiSetSelect.addEventListener('change', (e) => {
      const nextSetKey = e.target.value;
      if (!EMOJI_SETS.find((x) => x.key === nextSetKey)) return;

      this.selectedEmojiSetKey = nextSetKey;
      localStorage.setItem(EMOJI_SET_STORAGE_KEY, this.selectedEmojiSetKey);
      this.renderPreviewCard();
    });
  },

  createFlashOverlay() {
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.classList.add('flash-overlay');
    document.body.appendChild(this.flashOverlay);
  },

  openSettings() {
    this.syncSettingsControls();
    this.showScreen(screenSettings);
  },

  openExitConfirm() {
    if (!this.isPlaying) return;

    this.pausedCardElapsed = Date.now() - this.cardStartTime;
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    this.showScreen(screenGame);
    screenExitConfirm.classList.add('active');
  },

  continueAfterConfirm() {
    screenExitConfirm.classList.remove('active');
    this.isPlaying = true;
    this.startCardTimer(this.pausedCardElapsed);
    this.pausedCardElapsed = 0;
  },

  updateCardRingProgress(remaining) {
    const clampedRemaining = Math.max(0, Math.min(1, remaining));
    const segmentLength = clampedRemaining * 50;

    this.gameCardRings.forEach((ringEl) => {
      setCardRingSegments(ringEl, {
        firstStart: 0,
        secondStart: 50,
        firstLength: segmentLength,
        secondLength: segmentLength,
      });
    });
  },

  updatePreviewRingProgress(remaining) {
    if (!this.previewCardRing) return;

    const clampedRemaining = Math.max(0, Math.min(1, remaining));
    const segmentLength = clampedRemaining * 50;
    setCardRingSegments(this.previewCardRing, {
      firstStart: 0,
      secondStart: 50,
      firstLength: segmentLength,
      secondLength: segmentLength,
    });
  },

  startPreviewCycle() {
    if (!this.previewCardRing || !screenStart.classList.contains('active')) {
      return;
    }

    clearInterval(this.previewTimerInterval);
    this.previewCardStartTime = Date.now();
    this.updatePreviewRingProgress(1);

    this.previewTimerInterval = setInterval(() => {
      if (!screenStart.classList.contains('active')) return;

      const elapsed = Date.now() - this.previewCardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);

      this.updatePreviewRingProgress(remaining);

      if (remaining <= 0) {
        this.renderPreviewCard();
        this.previewCardStartTime = Date.now();
        this.updatePreviewRingProgress(1);
      }
    }, 50);
  },

  stopPreviewCycle() {
    clearInterval(this.previewTimerInterval);
    this.previewTimerInterval = null;
  },

  renderPreviewCard() {
    const stats = this.getCurrentDeckStats();
    const symbolsPerCard = stats ? stats.symbolsPerCard : 8;
    const previewSymbols = shuffle(this.getCurrentSymbols()).slice(
      0,
      symbolsPerCard,
    );
    positionEmojis(previewSymbols, cardPreview, false, null, {
      rotationRangeDegrees: this.iconRotationDegrees,
    });
  },

  formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  updateElapsedTime() {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    elapsedTime.textContent = this.formatElapsedTime(elapsed);
  },

  flash(type) {
    this.flashOverlay.className = 'flash-overlay';
    // Force reflow
    void this.flashOverlay.offsetWidth;
    this.flashOverlay.classList.add(
      type === 'correct' ? 'flash-correct' : 'flash-wrong',
    );
  },

  showScreen(screenEl) {
    document
      .querySelectorAll('.screen')
      .forEach((s) => s.classList.remove('active'));
    if (screenEl) screenEl.classList.add('active');

    if (screenEl === screenStart) {
      this.renderPreviewCard();
      this.startPreviewCycle();
    } else {
      this.stopPreviewCycle();
    }
  },

  startGame() {
    AudioManager.resume();

    // Generate and shuffle deck
    const { deck } = buildDeck(this.getCurrentSymbols());
    this.deck = shuffle(deck);

    // Limit to totalCardsInGame + 1 cards (need pairs)
    this.deck = this.deck.slice(0, this.totalCardsInGame + 1);

    this.currentCardIndex = 1;
    this.score = 0;
    this.startTime = Date.now();
    this.pausedCardElapsed = 0;
    this.isPlaying = true;
    this.isInputLocked = false;

    currentScore.textContent = '0';
    this.updateElapsedTime();

    // Set up first pair
    this.topCard = this.deck[0];
    this.bottomCard = this.deck[1];

    this.renderCards();
    this.updateCardsRemaining();
    this.startCardTimer();
    this.showScreen(screenGame);
  },

  renderCards() {
    // Top card
    positionEmojis(
      this.topCard,
      cardTop,
      true,
      (symbol, el) => {
        this.handleSymbolClick(symbol, el);
      },
      {
        rotationRangeDegrees: this.iconRotationDegrees,
      },
    );

    // Bottom card
    positionEmojis(
      this.bottomCard,
      cardBottom,
      true,
      (symbol, el) => {
        this.handleSymbolClick(symbol, el);
      },
      {
        rotationRangeDegrees: this.iconRotationDegrees,
      },
    );

    // Animate new cards
    cardTop.classList.remove('card-enter');
    void cardTop.offsetWidth;
    cardTop.classList.add('card-enter');
  },

  handleSymbolClick(symbol, el) {
    if (!this.isPlaying || this.isInputLocked) return;

    const commonSymbol = findCommonSymbol(this.topCard, this.bottomCard);

    if (symbol === commonSymbol) {
      this.isInputLocked = true;

      // Correct!
      el.classList.add('correct');
      this.flash('correct');
      AudioManager.play('correct');

      // Score based on remaining time
      const elapsed = Date.now() - this.cardStartTime;
      const timeBonus = Math.max(
        0,
        Math.floor((1 - elapsed / this.timePerCard) * 100),
      );
      this.score += 10 + timeBonus;
      currentScore.textContent = this.score;

      // Next card
      this.currentCardIndex++;
      if (this.currentCardIndex >= this.deck.length) {
        // Game over — won!
        setTimeout(() => this.endGame(true), 400);
      } else {
        setTimeout(() => {
          this.topCard = this.bottomCard;
          this.bottomCard = this.deck[this.currentCardIndex];
          this.renderCards();
          this.updateCardsRemaining();
          this.startCardTimer();
          this.isInputLocked = false;
        }, 350);
      }
    } else {
      // Wrong!
      el.classList.add('wrong');
      this.flash('wrong');
      AudioManager.play('wrong');

      // Penalty
      this.score = Math.max(0, this.score - 5);
      currentScore.textContent = this.score;

      setTimeout(() => el.classList.remove('wrong'), 400);
    }
  },

  startCardTimer(initialElapsed = 0) {
    this.cardStartTime = Date.now() - initialElapsed;
    clearInterval(this.timerInterval);

    const initialRemaining = Math.max(0, 1 - initialElapsed / this.timePerCard);
    timerFill.style.width = `${roundUiNumber(initialRemaining * 100)}%`;
    timerFill.classList.remove('warning');
    if (initialRemaining < 0.3) {
      timerFill.classList.add('warning');
    }

    this.updateCardRingProgress(initialRemaining);

    this.timerInterval = setInterval(() => {
      if (!this.isPlaying) return;

      const elapsed = Date.now() - this.cardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);
      this.updateElapsedTime();

      timerFill.style.width = `${roundUiNumber(remaining * 100)}%`;
      this.updateCardRingProgress(remaining);

      if (remaining < 0.3) {
        timerFill.classList.add('warning');
      }

      if (remaining <= 0) {
        // Time's up for this card — game over
        clearInterval(this.timerInterval);
        this.endGame(false);
      }
    }, 50);
  },

  updateCardsRemaining() {
    const total = Math.max(0, this.deck.length - 1);
    const done = Math.max(0, this.currentCardIndex - 1);
    cardsRemaining.textContent = `${done} / ${total}`;
  },

  quitGame() {
    this.isPlaying = false;
    this.isInputLocked = false;
    clearInterval(this.timerInterval);
    this.pausedCardElapsed = 0;
    screenExitConfirm.classList.remove('active');
    this.showScreen(screenStart);
  },

  endGame(won) {
    this.isPlaying = false;
    this.isInputLocked = false;
    clearInterval(this.timerInterval);
    screenExitConfirm.classList.remove('active');

    const elapsedMs = Date.now() - this.startTime;

    gameOverTitle.textContent = won ? 'Отлично!' : 'Время вышло!';
    finalScore.textContent = this.score;
    finalTime.textContent = this.formatElapsedTime(elapsedMs);

    // Best score from localStorage
    const bestKey = 'dobble_best_score';
    const prevBest = parseInt(localStorage.getItem(bestKey) || '0', 10);
    if (this.score > prevBest) {
      localStorage.setItem(bestKey, this.score.toString());
    }
    finalBest.textContent = Math.max(this.score, prevBest);

    AudioManager.play('gameover');
    this.showScreen(screenGameOver);
  },

  toggleSound() {
    const enabled = AudioManager.toggle();
    this.updateSoundIcon();
    toggleSound.checked = enabled;
  },

  updateSoundIcon() {
    if (AudioManager.enabled) {
      soundOnIcon.style.display = '';
      soundOffIcon.style.display = 'none';
    } else {
      soundOnIcon.style.display = 'none';
      soundOffIcon.style.display = '';
    }
  },
};

// ===== Start =====
document.addEventListener('DOMContentLoaded', () => {
  initCardRings();
  Game.init();
});
