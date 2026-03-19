// ===== Dobble Game Engine =====

import { getDeckStatsBySymbolsCount } from './dobble-math.js';
import { AudioManager } from './audio-manager.js';
import { buildDeck, shuffle, findCommonSymbol, sample } from './deck.js';
import { initI18n, setLang, t, getSupportedLangs, getLang } from './i18n.js';
import {
  roundUiNumber,
  initCardRings,
  updateRangeProgress,
  updateRingProgress,
  positionEmojis,
} from './ui-utils.js';
import {
  EMOJI_SET_STORAGE_KEY,
  TIME_PER_CARD_STORAGE_KEY,
  ICON_ROTATION_STORAGE_KEY,
  ROTATE_BY_POSITION_STORAGE_KEY,
  TIME_PER_CARD_MIN_SECONDS,
  TIME_PER_CARD_MAX_SECONDS,
  TIME_PER_CARD_STEP_SECONDS,
  DEFAULT_TIME_PER_CARD_MS,
  ICON_ROTATION_MIN_DEGREES,
  ICON_ROTATION_MAX_DEGREES,
  ICON_ROTATION_STEP_DEGREES,
  DEFAULT_ICON_ROTATION_DEGREES,
  EMOJI_SETS,
  snapTimerSeconds,
  snapIconRotationDegrees,
} from './settings.js';

import './app-version.js';
import './firebase.js';

// ===== Game State =====
const Game = {
  deck: [],
  selectedEmojiSetKey: EMOJI_SETS.at(0).key,
  currentCardIndex: 0,
  topCard: null,
  bottomCard: null,
  score: 0,
  startTime: 0,
  timerAnimationFrameId: null,
  previewAnimationFrameId: null,
  timePerCard: DEFAULT_TIME_PER_CARD_MS,
  iconRotationDegrees: DEFAULT_ICON_ROTATION_DEGREES,
  rotateByPosition: false,
  cardStartTime: 0,
  previewCardStartTime: 0,
  pausedCardElapsed: 0,
  gameCardRings: [],
  previewCardRing: null,
  isPlaying: false,
  isInputLocked: false,
  showHintOnWrong: true,
  totalCardsInGame: 20, // number of card pairs to play

  init() {
    this.loadEmojiSetPreference();
    this.loadTimerPreference();
    this.loadIconRotationPreference();
    this.loadRotateByPositionPreference();
    this.populateEmojiSetOptions();
    this.populateLangOptions();
    this.syncSettingsControls();
    this.bindEvents();
    AudioManager.init();
    this.createFlashOverlay();
    this.cacheGameCardRings();
    this.cachePreviewCardRing();
    initI18n(() => this.onLangApplied());
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

  populateLangOptions() {
    if (!langSelect) return;
    langSelect.innerHTML = '';
    getSupportedLangs().forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang.key;
      option.textContent = lang.label;
      langSelect.appendChild(option);
    });
    langSelect.value = getLang();
  },

  onLangApplied() {
    this.updateTimerDisplay(this.getTimePerCardSeconds());
    this.updateRotationDisplay(this.iconRotationDegrees);
    if (langSelect) langSelect.value = getLang();
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

  loadRotateByPositionPreference() {
    const saved = localStorage.getItem(ROTATE_BY_POSITION_STORAGE_KEY);
    this.rotateByPosition = saved === 'true';
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
    if (!screenStart.hidden) {
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
    timerValue.textContent = t('timer.seconds', { value: seconds });
  },

  updateRotationDisplay(degrees) {
    if (!rotationValue) return;
    rotationValue.textContent = t('rotation.degrees', { value: degrees });
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

    if (toggleRotateByPosition) {
      toggleRotateByPosition.checked = this.rotateByPosition;
    }
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
    const logoIcon = document.querySelector('.logo-icon');
    const logoMods = [
      'sepia',
      'blur',
      'invert',
      'opacity',
      'saturate',
      'bright',
      'acid',
      'bubble',
    ];
    let currentLogoMod = null;
    logoIcon.addEventListener('click', () => {
      if (currentLogoMod) logoIcon.classList.remove(currentLogoMod);
      currentLogoMod = sample(logoMods.filter((m) => m !== currentLogoMod));
      logoIcon.classList.add(currentLogoMod);
    });

    btnPlay.addEventListener('click', () => this.startGame());
    btnHowTo.addEventListener('click', () => this.showScreen(screenHowTo));
    btnOpenSettings.addEventListener('click', () => this.openSettings());
    btnBackHowTo.addEventListener('click', () => this.showScreen(screenStart));
    btnExitGame.addEventListener('click', () => this.openExitConfirm());
    btnSound.addEventListener('click', () => this.toggleSound());
    btnCloseSettings.addEventListener('click', () =>
      this.showScreen(screenStart),
    );
    btnResetProgress.addEventListener('click', () => {
      screenResetConfirm.hidden = false;
    });
    btnConfirmReset.addEventListener('click', () => this.resetProgress());
    btnCancelReset.addEventListener('click', () => {
      screenResetConfirm.hidden = true;
    });
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

    if (toggleRotateByPosition) {
      toggleRotateByPosition.addEventListener('change', (e) => {
        this.rotateByPosition = e.target.checked;
        localStorage.setItem(
          ROTATE_BY_POSITION_STORAGE_KEY,
          `${this.rotateByPosition}`,
        );
        this.renderPreviewCard();
      });
    }

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

    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        setLang(e.target.value, () => this.onLangApplied());
      });
    }
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
    this.stopCardTimer();
    this.showScreen(screenGame);
    screenExitConfirm.hidden = false;
  },

  continueAfterConfirm() {
    screenExitConfirm.hidden = true;
    this.isPlaying = true;
    this.startCardTimer(this.pausedCardElapsed);
    this.pausedCardElapsed = 0;
  },

  startPreviewCycle() {
    if (!this.previewCardRing || screenStart.hidden) {
      return;
    }

    this.stopPreviewCycle();
    this.previewCardStartTime = Date.now();
    updateRingProgress(this.previewCardRing, 1);

    const tick = () => {
      if (screenStart.hidden) {
        this.stopPreviewCycle();
        return;
      }

      const elapsed = Date.now() - this.previewCardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);

      updateRingProgress(this.previewCardRing, remaining);

      if (remaining <= 0) {
        this.renderPreviewCard();
        this.previewCardStartTime = Date.now();
        updateRingProgress(this.previewCardRing, 1);
      }

      this.previewAnimationFrameId = requestAnimationFrame(tick);
    };

    this.previewAnimationFrameId = requestAnimationFrame(tick);
  },

  stopPreviewCycle() {
    if (this.previewAnimationFrameId !== null) {
      cancelAnimationFrame(this.previewAnimationFrameId);
      this.previewAnimationFrameId = null;
    }
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
      rotateByPosition: this.rotateByPosition,
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
      .forEach((s) => (s.hidden = true));
    if (screenEl) screenEl.hidden = false;

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
    const onSymbolClick = (symbol, el) => this.handleSymbolClick(symbol, el);
    const layoutOptions = {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
    };
    positionEmojis(this.topCard, cardTop, true, onSymbolClick, layoutOptions);
    positionEmojis(
      this.bottomCard,
      cardBottom,
      true,
      onSymbolClick,
      layoutOptions,
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

      if (this.showHintOnWrong) {
        this.highlightCommonSymbol();
      }
      setTimeout(() => {
        el.classList.remove('wrong');
        this.clearHints();
      }, 1200);
    }
  },

  highlightCommonSymbol() {
    const commonSymbol = findCommonSymbol(this.topCard, this.bottomCard);
    if (!commonSymbol) return;
    document.querySelectorAll('.emoji-item').forEach((el) => {
      if (el.dataset.symbol === commonSymbol) {
        el.classList.add('hint');
      }
    });
  },

  clearHints() {
    document.querySelectorAll('.emoji-item.hint').forEach((el) => {
      el.classList.remove('hint');
    });
  },

  startCardTimer(initialElapsed = 0) {
    this.cardStartTime = Date.now() - initialElapsed;
    this.stopCardTimer();

    const initialRemaining = Math.max(0, 1 - initialElapsed / this.timePerCard);
    timerFill.style.width = `${roundUiNumber(initialRemaining * 100)}%`;
    timerFill.classList.remove('warning');
    if (initialRemaining < 0.3) {
      timerFill.classList.add('warning');
    }

    updateRingProgress(this.gameCardRings, initialRemaining);

    const tick = () => {
      if (!this.isPlaying) {
        this.timerAnimationFrameId = null;
        return;
      }

      const elapsed = Date.now() - this.cardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);
      this.updateElapsedTime();

      timerFill.style.width = `${roundUiNumber(remaining * 100)}%`;
      updateRingProgress(this.gameCardRings, remaining);

      if (remaining < 0.3) {
        timerFill.classList.add('warning');
      }

      if (remaining <= 0) {
        // Time's up for this card — game over
        this.stopCardTimer();
        this.highlightCommonSymbol();
        setTimeout(() => this.endGame(false), 1200);
        return;
      }

      this.timerAnimationFrameId = requestAnimationFrame(tick);
    };

    this.timerAnimationFrameId = requestAnimationFrame(tick);
  },

  stopCardTimer() {
    if (this.timerAnimationFrameId !== null) {
      cancelAnimationFrame(this.timerAnimationFrameId);
      this.timerAnimationFrameId = null;
    }
  },

  updateCardsRemaining() {
    const total = Math.max(0, this.deck.length - 1);
    const done = Math.max(0, this.currentCardIndex - 1);
    cardsRemaining.textContent = `${done} / ${total}`;
  },

  quitGame() {
    this.isPlaying = false;
    this.isInputLocked = false;
    this.stopCardTimer();
    this.pausedCardElapsed = 0;
    screenExitConfirm.hidden = true;
    this.showScreen(screenStart);
  },

  endGame(won) {
    this.isPlaying = false;
    this.isInputLocked = false;
    this.stopCardTimer();
    screenExitConfirm.hidden = true;

    const elapsedMs = Date.now() - this.startTime;

    gameOverTitle.textContent = won ? t('gameover.win') : t('gameover.lose');
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

  resetProgress() {
    localStorage.removeItem('dobble_best_score');
    screenResetConfirm.hidden = true;
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
