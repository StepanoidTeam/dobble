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
  TIME_PER_CARD_MIN_SECONDS,
  TIME_PER_CARD_MAX_SECONDS,
  TIME_PER_CARD_STEP_SECONDS,
  DEFAULT_TIME_PER_CARD_MS,
  DEFAULT_ICON_ROTATION_DEGREES,
  EMOJI_SETS,
  snapTimerSeconds,
} from './settings.js';
import { SettingsOptionsManager } from './settings-options/index.js';
import { Leaderboard } from './leaderboard.js';

import './app-version.js';
import './auth.js';

const FEEDBACK_CORRECT = 'correct';
const FEEDBACK_WRONG = 'wrong';
const CARD_TRANSITION_DURATION_MS = 350;

// ===== Scoring Constants =====
const SCORE_BASE = 100;
const SCORE_SPEED_MAX = 100;
const SCORE_HINTED_BASE = 10;
const SCORE_PENALTY_BASE = 50;
const STREAK_CAP = 10;
const STREAK_BONUS_PER_LEVEL = 0.1;
const PROGRESSION_BONUS_PER_CARD = 0.02;

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
  useCustomEmojiRender: true,
  cardStartTime: 0,
  previewCardStartTime: 0,
  isPreviewTransitioning: false,
  pausedCardElapsed: 0,
  streak: 0,
  bestStreak: 0,
  hintedCurrentCard: false,
  $$gameCardRings: [],
  $previewCardRing: null,
  $flashOverlay: null,
  isPlaying: false,
  isInputLocked: false,
  showHintOnWrong: true,
  totalCardsInGame: 20, // number of card pairs to play
  selectedMode: 'classic',

  init() {
    this.loadEmojiSetPreference();
    this.loadTimerPreference();
    SettingsOptionsManager.init(this);
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
    this.$$gameCardRings = Array.from(
      document.querySelectorAll(
        '.card-top .card-ring, .card-bottom .card-ring',
      ),
    );
  },

  cachePreviewCardRing() {
    this.$previewCardRing = document.querySelector('.card-preview .card-ring');
  },

  populateEmojiSetOptions() {
    if (!$emojiSetSelect) return;

    $emojiSetSelect.innerHTML = '';
    EMOJI_SETS.forEach((setConfig) => {
      const $option = document.createElement('option');
      $option.value = setConfig.key;
      $option.textContent = setConfig.label;
      $emojiSetSelect.appendChild($option);
    });

    $emojiSetSelect.value = this.selectedEmojiSetKey;
  },

  populateLangOptions() {
    if (!$langSelect) return;
    $langSelect.innerHTML = '';
    getSupportedLangs().forEach((lang) => {
      const $option = document.createElement('option');
      $option.value = lang.key;
      $option.textContent = lang.label;
      $langSelect.appendChild($option);
    });
    $langSelect.value = getLang();
  },

  onLangApplied() {
    this.updateTimerDisplay(this.getTimePerCardSeconds());
    this.updateRotationDisplay(this.iconRotationDegrees);
    if ($langSelect) $langSelect.value = getLang();
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

  getTimePerCardSeconds() {
    return Math.round(this.timePerCard / 1000);
  },

  applyTimePerCardSeconds(seconds) {
    const snappedSeconds = snapTimerSeconds(seconds);
    this.timePerCard = snappedSeconds * 1000;
    localStorage.setItem(TIME_PER_CARD_STORAGE_KEY, `${this.timePerCard}`);
    this.updateTimerDisplay(snappedSeconds);
    if ($timerRange) {
      $timerRange.value = `${snappedSeconds}`;
      updateRangeProgress($timerRange);
    }
    if (!$screenStart.hidden) {
      this.startPreviewCycle();
    }
  },

  applyIconRotationDegrees(degrees) {
    this.iconRotationDegrees = degrees;
    this.updateRotationDisplay(degrees);
    this.renderPreviewCard();
  },

  updateTimerDisplay(seconds) {
    if (!$timerValue) return;
    $timerValue.textContent = t('timer.seconds', { value: seconds });
  },

  updateRotationDisplay(degrees) {
    if (!$rotationValue) return;
    $rotationValue.textContent = t('rotation.degrees', { value: degrees });
  },

  syncSettingsControls() {
    if ($toggleSound) {
      $toggleSound.checked = AudioManager.enabled;
    }

    if ($timerRange) {
      $timerRange.min = `${TIME_PER_CARD_MIN_SECONDS}`;
      $timerRange.max = `${TIME_PER_CARD_MAX_SECONDS}`;
      $timerRange.step = `${TIME_PER_CARD_STEP_SECONDS}`;
      $timerRange.value = `${this.getTimePerCardSeconds()}`;
      updateRangeProgress($timerRange);
    }

    this.updateTimerDisplay(this.getTimePerCardSeconds());
    SettingsOptionsManager.syncControls(this);
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
    const $logoIcon = document.querySelector('.logo-icon');
    const $logoContainer = document.querySelector('.logo-container');
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
    $logoIcon.addEventListener('click', () => {
      if (currentLogoMod) $logoIcon.classList.remove(currentLogoMod);
      currentLogoMod = sample(logoMods.filter((m) => m !== currentLogoMod));
      $logoIcon.classList.add(currentLogoMod);

      $logoContainer.classList.remove('logo-press');
      void $logoContainer.offsetWidth;
      $logoContainer.classList.add('logo-press');
    });

    $btnPlay.addEventListener('click', () =>
      this.showScreen($screenModeSelect),
    );
    $btnStartWithMode.addEventListener('click', () => this.startGame());
    $btnModeBack.addEventListener('click', () => this.showScreen($screenStart));
    document.querySelectorAll('.mode-card').forEach(($card) => {
      $card.addEventListener('click', () =>
        this.selectMode($card.dataset.mode),
      );
    });
    $btnHowTo.addEventListener('click', () => this.showScreen($screenHowTo));
    $btnOpenSettings.addEventListener('click', () => this.openSettings());
    $btnBackHowTo.addEventListener('click', () =>
      this.showScreen($screenStart),
    );
    $btnExitGame.addEventListener('click', () => this.openExitConfirm());
    $btnSound.addEventListener('click', () => this.toggleSound());
    $btnCloseSettings.addEventListener('click', () =>
      this.showScreen($screenStart),
    );
    $btnResetProgress.addEventListener('click', () => {
      $screenResetConfirm.hidden = false;
    });
    $btnConfirmReset.addEventListener('click', () => this.resetProgress());
    $btnCancelReset.addEventListener('click', () => {
      $screenResetConfirm.hidden = true;
    });
    $btnContinueGame.addEventListener('click', () =>
      this.continueAfterConfirm(),
    );
    $btnConfirmExit.addEventListener('click', () => this.quitGame());
    $btnPlayAgain.addEventListener('click', () => this.startGame());
    $btnMenu.addEventListener('click', () => this.quitGame());
    $btnLeaderboard.addEventListener('click', () => this.showLeaderboard());
    $btnLeaderboardBack.addEventListener('click', () =>
      this.showScreen($screenStart),
    );

    $toggleSound.addEventListener('change', (e) => {
      AudioManager.enabled = e.target.checked;
      this.updateSoundIcon();
    });

    if ($timerRange) {
      $timerRange.addEventListener('input', (e) => {
        updateRangeProgress(e.target);
        const nextValue = parseInt(e.target.value, 10);
        if (Number.isNaN(nextValue)) return;
        this.applyTimePerCardSeconds(nextValue);
      });
    }

    SettingsOptionsManager.bindEvents(this);

    if (!$emojiSetSelect) return;

    $emojiSetSelect.addEventListener('change', (e) => {
      const nextSetKey = e.target.value;
      if (!EMOJI_SETS.find((x) => x.key === nextSetKey)) return;

      this.selectedEmojiSetKey = nextSetKey;
      localStorage.setItem(EMOJI_SET_STORAGE_KEY, this.selectedEmojiSetKey);
      this.renderPreviewCard();
    });

    if ($langSelect) {
      $langSelect.addEventListener('change', (e) => {
        setLang(e.target.value, () => this.onLangApplied());
      });
    }
  },

  createFlashOverlay() {
    this.$flashOverlay = document.createElement('div');
    this.$flashOverlay.classList.add('flash-overlay');
    document.body.appendChild(this.$flashOverlay);
  },

  selectMode(mode) {
    this.selectedMode = mode;
    document.querySelectorAll('.mode-card').forEach(($card) => {
      $card.classList.toggle(
        'mode-card--selected',
        $card.dataset.mode === mode,
      );
    });
  },

  openSettings() {
    this.syncSettingsControls();
    this.showScreen($screenSettings);
  },

  openExitConfirm() {
    if (!this.isPlaying) return;

    this.pausedCardElapsed = Date.now() - this.cardStartTime;
    this.isPlaying = false;
    this.stopCardTimer();
    this.showScreen($screenGame);
    $screenExitConfirm.hidden = false;
  },

  continueAfterConfirm() {
    $screenExitConfirm.hidden = true;
    this.isPlaying = true;
    this.startCardTimer(this.pausedCardElapsed);
    this.pausedCardElapsed = 0;
  },

  startPreviewCycle() {
    if (!this.$previewCardRing || $screenStart.hidden) {
      return;
    }

    this.stopPreviewCycle();
    this.previewCardStartTime = Date.now();
    updateRingProgress(this.$previewCardRing, 1);

    const tick = () => {
      if ($screenStart.hidden) {
        this.stopPreviewCycle();
        return;
      }

      const elapsed = Date.now() - this.previewCardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);

      updateRingProgress(this.$previewCardRing, remaining);

      if (remaining <= 0 && !this.isPreviewTransitioning) {
        this.isPreviewTransitioning = true;
        this.playCardAnimation($cardPreview, 'card-exit');

        setTimeout(() => {
          this.renderPreviewCard();
          this.playCardAnimation($cardPreview, 'card-enter');
          this.previewCardStartTime = Date.now();
          updateRingProgress(this.$previewCardRing, 1);
          this.isPreviewTransitioning = false;
        }, CARD_TRANSITION_DURATION_MS);
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
    positionEmojis(previewSymbols, $cardPreview, false, null, {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
      useCustomEmojiImages: this.useCustomEmojiRender,
    });
  },

  formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  // ===== Scoring =====
  calcDifficultyMult() {
    const maxMs = TIME_PER_CARD_MAX_SECONDS * 1000;
    return Math.sqrt(maxMs / this.timePerCard);
  },

  calcCardScore(elapsed, hinted) {
    const difficultyMult = this.calcDifficultyMult();

    if (hinted) {
      const progressionMult =
        1 + (this.currentCardIndex - 1) * PROGRESSION_BONUS_PER_CARD;
      return Math.round(SCORE_HINTED_BASE * difficultyMult * progressionMult);
    }

    const speedBonus = Math.max(
      0,
      Math.floor((1 - elapsed / this.timePerCard) * SCORE_SPEED_MAX),
    );
    const streakMult =
      1 + Math.min(this.streak, STREAK_CAP) * STREAK_BONUS_PER_LEVEL;
    const progressionMult =
      1 + (this.currentCardIndex - 1) * PROGRESSION_BONUS_PER_CARD;

    return Math.round(
      (SCORE_BASE + speedBonus) * difficultyMult * streakMult * progressionMult,
    );
  },

  calcPenalty() {
    return Math.round(SCORE_PENALTY_BASE * this.calcDifficultyMult());
  },

  calcTotalMult() {
    const difficultyMult = this.calcDifficultyMult();
    const streakMult =
      1 + Math.min(this.streak, STREAK_CAP) * STREAK_BONUS_PER_LEVEL;
    const progressionMult =
      1 + (this.currentCardIndex - 1) * PROGRESSION_BONUS_PER_CARD;
    return difficultyMult * streakMult * progressionMult;
  },

  updateMultiplierDisplay() {
    const mult = this.calcTotalMult();
    $currentMultiplier.textContent = `×${mult.toFixed(1)}`;
  },

  hudBump($el) {
    $el.classList.remove('hud-bump');
    void $el.offsetWidth;
    $el.classList.add('hud-bump');
  },

  showScorePopup(points) {
    const $popup = document.createElement('div');
    $popup.classList.add(
      'score-popup',
      points >= 0 ? 'score-positive' : 'score-negative',
    );
    $popup.textContent = points >= 0 ? `+${points}` : `${points}`;

    const $gameArea = document.querySelector('.game-area');
    $gameArea.appendChild($popup);

    $popup.addEventListener('animationend', () => $popup.remove());
  },

  updateElapsedTime() {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    $elapsedTime.textContent = this.formatElapsedTime(elapsed);
  },

  flash(feedbackType) {
    this.$flashOverlay.className = 'flash-overlay';
    // Force reflow
    void this.$flashOverlay.offsetWidth;
    this.$flashOverlay.classList.add(
      feedbackType === FEEDBACK_CORRECT ? 'flash-correct' : 'flash-wrong',
    );
  },

  showFeedbackIcon(feedbackType) {
    const $icon = $feedbackIcon;

    const iconImgs = {
      [FEEDBACK_CORRECT]: 'icon-correct',
      [FEEDBACK_WRONG]: 'icon-wrong',
    };

    const $img = document.querySelector(`.${iconImgs[feedbackType]}`);

    $img.hidden = false;

    $icon.hidden = false;
    // Re-trigger animation
    $img.style.animation = 'none';
    void $img.offsetWidth;
    $img.style.animation = '';
    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => {
      $icon.hidden = true;
      $img.hidden = true;
    }, 500);
  },

  showScreen($screenEl) {
    document
      .querySelectorAll('.screen')
      .forEach(($screen) => ($screen.hidden = true));
    if ($screenEl) $screenEl.hidden = false;

    if ($screenEl === $screenStart) {
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
    this.streak = 0;
    this.bestStreak = 0;
    this.hintedCurrentCard = false;
    this.startTime = Date.now();
    this.pausedCardElapsed = 0;
    this.isPlaying = true;
    this.isInputLocked = false;

    $currentScore.textContent = '0';
    $currentStreak.textContent = '0';
    this.updateMultiplierDisplay();
    this.updateElapsedTime();

    // Set up first pair
    this.topCard = this.deck[0];
    this.bottomCard = this.deck[1];

    this.renderCards();
    this.updateCardsRemaining();
    this.startCardTimer();
    this.showScreen($screenGame);
  },

  renderCards() {
    const onSymbolClick = (symbol, $el) => this.handleSymbolClick(symbol, $el);
    const layoutOptions = {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
      useCustomEmojiImages: this.useCustomEmojiRender,
    };
    positionEmojis(this.topCard, $cardTop, true, onSymbolClick, layoutOptions);
    positionEmojis(
      this.bottomCard,
      $cardBottom,
      true,
      onSymbolClick,
      layoutOptions,
    );

    this.playCardAnimation($cardTop, 'card-enter');
    this.playCardAnimation($cardBottom, 'card-enter');
  },

  playCardAnimation($cardEl, className) {
    if (!$cardEl) return;
    $cardEl.classList.remove('card-enter', 'card-exit');
    void $cardEl.offsetWidth;
    $cardEl.classList.add(className);
  },

  transitionToNextCards() {
    this.playCardAnimation($cardTop, 'card-exit');
    this.playCardAnimation($cardBottom, 'card-exit');

    setTimeout(() => {
      this.topCard = this.bottomCard;
      this.bottomCard = this.deck[this.currentCardIndex];
      this.renderCards();
      this.updateCardsRemaining();
      this.startCardTimer();
      this.isInputLocked = false;
    }, CARD_TRANSITION_DURATION_MS);
  },

  handleSymbolClick(symbol, $el) {
    if (!this.isPlaying || this.isInputLocked) return;

    const commonSymbol = findCommonSymbol(this.topCard, this.bottomCard);

    if (symbol === commonSymbol) {
      this.isInputLocked = true;

      // Correct!
      $el.classList.add(FEEDBACK_CORRECT);
      this.flash(FEEDBACK_CORRECT);
      this.showFeedbackIcon(FEEDBACK_CORRECT);
      AudioManager.play(FEEDBACK_CORRECT);

      // Score based on remaining time, difficulty, streak, progression
      const elapsed = Date.now() - this.cardStartTime;
      const cardPoints = this.calcCardScore(elapsed, this.hintedCurrentCard);
      this.score += cardPoints;
      $currentScore.textContent = this.score;
      this.hudBump($currentScore);
      this.showScorePopup(cardPoints);

      // Streak: only grows on clean (not hinted) cards
      if (this.hintedCurrentCard) {
        this.streak = 0;
      } else {
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      }
      $currentStreak.textContent = this.streak;
      this.hudBump($currentStreak);
      this.hintedCurrentCard = false;
      this.updateMultiplierDisplay();
      this.hudBump($currentMultiplier);

      // Next card
      this.currentCardIndex++;
      if (this.currentCardIndex >= this.deck.length) {
        // Game over — won!
        setTimeout(() => this.endGame(true), 400);
      } else {
        this.transitionToNextCards();
      }
    } else {
      // Wrong!
      $el.classList.add(FEEDBACK_WRONG);
      this.flash(FEEDBACK_WRONG);
      this.showFeedbackIcon(FEEDBACK_WRONG);
      AudioManager.play(FEEDBACK_WRONG);

      // Penalty + streak reset
      const penalty = this.calcPenalty();
      this.score -= penalty;
      $currentScore.textContent = this.score;
      this.hudBump($currentScore);
      this.showScorePopup(-penalty);

      this.streak = 0;
      $currentStreak.textContent = this.streak;
      this.hudBump($currentStreak);
      this.hintedCurrentCard = true;
      this.updateMultiplierDisplay();
      this.hudBump($currentMultiplier);

      if (this.showHintOnWrong) {
        this.highlightCommonSymbol();
      }
      setTimeout(() => {
        $el.classList.remove(FEEDBACK_WRONG);
        this.clearHints();
      }, 1200);
    }
  },

  highlightCommonSymbol() {
    const commonSymbol = findCommonSymbol(this.topCard, this.bottomCard);
    if (!commonSymbol) return;
    document.querySelectorAll('.emoji-item').forEach(($el) => {
      if ($el.dataset.symbol === commonSymbol) {
        $el.classList.add('hint');
      }
    });
  },

  clearHints() {
    document.querySelectorAll('.emoji-item.hint').forEach(($el) => {
      $el.classList.remove('hint');
    });
  },

  startCardTimer(initialElapsed = 0) {
    this.cardStartTime = Date.now() - initialElapsed;
    this.stopCardTimer();

    const initialRemaining = Math.max(0, 1 - initialElapsed / this.timePerCard);
    $timerFill.style.width = `${roundUiNumber(initialRemaining * 100)}%`;
    $timerFill.classList.remove('warning');
    if (initialRemaining < 0.3) {
      $timerFill.classList.add('warning');
    }

    updateRingProgress(this.$$gameCardRings, initialRemaining);

    const tick = () => {
      if (!this.isPlaying) {
        this.timerAnimationFrameId = null;
        return;
      }

      const elapsed = Date.now() - this.cardStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.timePerCard);
      this.updateElapsedTime();

      $timerFill.style.width = `${roundUiNumber(remaining * 100)}%`;
      updateRingProgress(this.$$gameCardRings, remaining);

      if (remaining < 0.3) {
        $timerFill.classList.add('warning');
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
    $cardsRemaining.textContent = `${done} / ${total}`;
  },

  quitGame() {
    this.isPlaying = false;
    this.isInputLocked = false;
    this.stopCardTimer();
    this.pausedCardElapsed = 0;
    $screenExitConfirm.hidden = true;
    this.showScreen($screenStart);
  },

  endGame(won) {
    this.isPlaying = false;
    this.isInputLocked = false;
    this.stopCardTimer();
    $screenExitConfirm.hidden = true;

    const elapsedMs = Date.now() - this.startTime;

    $gameOverTitle.textContent = won ? t('gameover.win') : t('gameover.lose');
    $finalScore.textContent = this.score;
    $finalTime.textContent = this.formatElapsedTime(elapsedMs);
    $finalStreak.textContent = this.bestStreak;

    // Best score from localStorage
    const bestKey = 'dobble_best_score';
    const prevBest = parseInt(localStorage.getItem(bestKey) || '0', 10);
    if (this.score > prevBest) {
      localStorage.setItem(bestKey, this.score.toString());
    }
    $finalBest.textContent = Math.max(this.score, prevBest);

    // Submit to leaderboard
    Leaderboard.submitScore({
      score: this.score,
      timeMs: elapsedMs,
      bestStreak: this.bestStreak,
      timePerCardMs: this.timePerCard,
      cardsPlayed: this.currentCardIndex - 1,
    });

    AudioManager.play('gameover');
    this.showScreen($screenGameOver);
  },

  resetProgress() {
    localStorage.removeItem('dobble_best_score');
    $screenResetConfirm.hidden = true;
  },

  showLeaderboard() {
    this.showScreen($screenLeaderboard);
    Leaderboard.render();
  },

  toggleSound() {
    const enabled = AudioManager.toggle();
    this.updateSoundIcon();
    $toggleSound.checked = enabled;
  },

  updateSoundIcon() {
    if (AudioManager.enabled) {
      $soundOnIcon.style.display = '';
      $soundOffIcon.style.display = 'none';
    } else {
      $soundOnIcon.style.display = 'none';
      $soundOffIcon.style.display = '';
    }
  },
};

// ===== Start =====
document.addEventListener('DOMContentLoaded', () => {
  initCardRings();
  Game.init();
});
