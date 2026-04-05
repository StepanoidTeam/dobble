// ===== Dobble Game Engine =====

import { getDeckStatsBySymbolsCount } from './helpers/dobble-math.js';
import { AudioManager } from './audio-manager.js';
import { buildDeck, findCommonSymbol } from './helpers/deck.js';
import { Random, stringToSeed, cardToSeed } from './helpers/seeded-random.js';
import {
  initI18n,
  setLang,
  t,
  getSupportedLangs,
  getLang,
} from './helpers/i18n.js';
import {
  roundUiNumber,
  initCardRings,
  updateRingProgress,
  positionEmojis,
  renderAvatarHtml,
} from './helpers/ui-utils.js';
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
import { Profile } from './profile.js';
import { Multiplayer } from './multiplayer.js';
import { auth, onAuthStateChanged } from './firebase/firebase.js';
import {
  rtdb,
  ref,
  remove,
  set,
  rtdbOnValue,
} from './firebase/firebase-rtdb.js';
import { launchConfetti, stopConfetti } from './helpers/confetti.js';
import {
  playLogoEffect,
  playLogoPress,
  startAutoPlay,
  stopAutoPlay,
} from './helpers/logo-animations.js';
import { EMOJIS_CLASSIC } from './emojis/emojis-classic.js';

import './helpers/app-version.js';
import './firebase/auth.js';

import './components/input-range.js';

const FEEDBACK_CORRECT = 'correct';
const FEEDBACK_WRONG = 'wrong';
const CARD_TRANSITION_DURATION_MS = 250;
const CARD_FLY_DURATION_MS = 300;
const MP_WRONG_PENALTY_MS = 2000;
const ABILITY_CLOCK_DURATION_MS = 5000;
const DEBUG_ABILITIES = true;
const MP_ROOM_CODE_KEY = 'dobble_mp_room';

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
  mpLastRenderedRound: -1,
  abilitySelected: null,
  abilityClockCooldown: false,
  _abilityListener: null,
  $abilityClockProgress: null,

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
    this.cacheAbilityProgress();
    initI18n(() => this.onLangApplied());
    this.renderPreviewCard();
    this.startPreviewCycle();
    this.updateCardsRemaining();
    this.updateElapsedTime();
    Profile.init((displayName, avatar) => {
      if ($playerNameInput) $playerNameInput.value = displayName;
      this.renderAvatarPicker(avatar);
    });
    // Start logo auto-play if on start screen
    if (!$screenStart.hidden) {
      startAutoPlay($logoIcon, $logoContainer);
    }
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

  cacheAbilityProgress() {
    this.$abilityClockProgress = $abilityClock.querySelector(
      '.ability-progress circle',
    );
    if (this.$abilityClockProgress) {
      this.$abilityClockProgress.style.strokeDashoffset = '150.8';
    }
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
    $logoIcon.addEventListener('click', () => {
      playLogoEffect($logoIcon, { fromClick: true });
      playLogoPress($logoContainer);
      startAutoPlay($logoIcon, $logoContainer);
    });

    $btnPlay.addEventListener('click', () => this.showScreen($screenPlayType));
    $btnSolo.addEventListener('click', () =>
      this.showScreen($screenModeSelect),
    );
    $btnPvP.addEventListener('click', () =>
      this.showScreen($screenMultiplayer),
    );
    $btnOnline.addEventListener('click', () => {
      this.showScreen($screenMultiplayer);
      this.mpRefreshRoomStats();
    });
    $btnPlayTypeBack.addEventListener('click', () =>
      this.showScreen($screenStart),
    );
    $btnStartWithMode.addEventListener('click', () => this.startGame());
    $btnModeBack.addEventListener('click', () =>
      this.showScreen($screenPlayType),
    );
    $screenModeSelect
      .querySelector('.mode-cards')
      .addEventListener('change', (e) => {
        this.selectedMode = e.target.value;
      });
    $btnHowTo.addEventListener('click', () => this.showScreen($screenHowTo));
    $btnOpenSettings.addEventListener('click', () => this.openSettings());
    $btnBackHowTo.addEventListener('click', () =>
      this.showScreen($screenStart),
    );
    $btnGameMenu.addEventListener('click', () => this.openGameMenu());
    $btnCloseSettings.addEventListener('click', () => this.closeSettings());
    // Settings tab switching
    $screenSettings
      .querySelector('.settings-tabs')
      .addEventListener('click', (e) => {
        const $tab = e.target.closest('.settings-tab');
        if (!$tab) return;
        const tabKey = $tab.dataset.tab;
        $screenSettings.querySelectorAll('.settings-tab').forEach(($t) => {
          const isActive = $t.dataset.tab === tabKey;
          $t.classList.toggle('active', isActive);
          $t.setAttribute('aria-selected', isActive);
        });
        $screenSettings.querySelectorAll('[data-tab-content]').forEach(($c) => {
          $c.hidden = $c.dataset.tabContent !== tabKey;
        });
      });
    $btnResetProgress.addEventListener('click', () => {
      $screenResetConfirm.hidden = false;
    });
    $btnConfirmReset.addEventListener('click', () => this.resetProgress());
    $btnCancelReset.addEventListener('click', () => {
      $screenResetConfirm.hidden = true;
    });
    $btnMenuContinue.addEventListener('click', () => this.closeGameMenu());
    $btnMenuSettings.addEventListener('click', () => {
      $screenGameMenu.hidden = true;
      this.openSettings('game');
    });
    $btnMenuExit.addEventListener('click', () => this.quitGame());
    $btnPlayAgain.addEventListener('click', () => this.startGame());
    $btnMenu.addEventListener('click', () => this.quitGame());
    $btnLeaderboard.addEventListener('click', () => this.showLeaderboard());
    $btnLeaderboardBack.addEventListener('click', () =>
      this.showScreen($screenStart),
    );

    // ===== Multiplayer Events =====
    $btnMultiplayerBack.addEventListener('click', () =>
      this.showScreen($screenPlayType),
    );
    $btnCreateRoom.addEventListener('click', () => this.mpCreateRoom());
    $btnJoinRoom.addEventListener('click', () => this.mpJoinRoom());
    $btnFindGame.addEventListener('click', () => this.mpFindGame());
    $btnCopyCode.addEventListener('click', () => this.mpCopyCode());
    $btnLeaveLobby.addEventListener('click', () => this.mpLeaveRoom());
    $btnMpResultsMenu.addEventListener('click', () => this.quitGame());
    $inputRoomCode.addEventListener('input', () => {
      $inputRoomCode.value = $inputRoomCode.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    });

    // ===== Ability Events =====
    $abilityClock.addEventListener('click', () => this.abilitySelectClock());
    $mpPlayersList.addEventListener('click', (e) => {
      if (!this.abilitySelected) return;
      const $row = e.target.closest('.mp-player-row');
      if (!$row || !$row.classList.contains('ability-targetable')) return;
      this.abilityUseOnPlayer($row.dataset.uid);
    });

    $toggleSound.addEventListener('change', (e) => {
      AudioManager.enabled = e.target.checked;
    });

    if ($playerNameInput) {
      const saveName = () => Profile.updateDisplayName($playerNameInput.value);
      $playerNameInput.addEventListener('blur', saveName);
      $playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          $playerNameInput.blur();
        }
      });
    }

    this.bindAvatarPicker();

    if ($timerRange) {
      $timerRange.addEventListener('input', (e) => {
        const nextValue = parseInt(e.target.value, 10);
        if (Number.isNaN(nextValue)) return;
        this.applyTimePerCardSeconds(nextValue);
      });
    }

    if ($selectMaxPlayers && $maxPlayersValue) {
      const updateMaxPlayersValue = () => {
        $maxPlayersValue.textContent = `${$selectMaxPlayers.value}`;
      };

      $selectMaxPlayers.addEventListener('input', updateMaxPlayersValue);
      updateMaxPlayersValue();
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
    const $radio = $screenModeSelect.querySelector(`input[value="${mode}"]`);
    if ($radio) $radio.checked = true;
  },

  openSettings(returnTo) {
    this._settingsReturnTo = returnTo || null;
    this.syncSettingsControls();
    this.showScreen($screenSettings);
  },

  closeSettings() {
    if (this._settingsReturnTo === 'game') {
      this._settingsReturnTo = null;
      this.showScreen($screenGame);
      // Resume solo game if was playing
      if (this.pausedCardElapsed > 0) {
        this.isPlaying = true;
        this.startCardTimer(this.pausedCardElapsed);
        this.pausedCardElapsed = 0;
      }
    } else {
      this.showScreen($screenStart);
    }
  },

  openGameMenu() {
    if (this.isPlaying && !Multiplayer.roomCode) {
      // Solo game — pause timer
      this.pausedCardElapsed = Date.now() - this.cardStartTime;
      this.isPlaying = false;
      this.stopCardTimer();
    }
    $screenGameMenu.hidden = false;
  },

  closeGameMenu() {
    $screenGameMenu.hidden = true;
    // Resume solo game if was paused
    if (this.pausedCardElapsed > 0 && !Multiplayer.roomCode) {
      this.isPlaying = true;
      this.startCardTimer(this.pausedCardElapsed);
      this.pausedCardElapsed = 0;
    }
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
        const exitAnim = this.playCardAnimation($cardPreview, 'card-exit');

        exitAnim?.finished.then(() => {
          this.renderPreviewCard();
          this.playCardAnimation($cardPreview, 'card-enter');
          this.previewCardStartTime = Date.now();
          updateRingProgress(this.$previewCardRing, 1);
          this.isPreviewTransitioning = false;
        });
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
    const previewSymbols = Random.shuffle(this.getCurrentSymbols()).slice(
      0,
      symbolsPerCard,
    );
    positionEmojis(previewSymbols, $cardPreview, false, null, {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
      useCustomEmojiImages: this.useCustomEmojiRender,
      emojiSetKey: this.selectedEmojiSetKey,
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
    $el.animate([{ scale: 1 }, { scale: 1.35, offset: 0.3 }, { scale: 1 }], {
      duration: 350,
      easing: 'ease-out',
    });
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

    $popup
      .animate(
        [
          { opacity: 1, translate: '-50% -50%', scale: 0.6 },
          { opacity: 1, scale: 1.15, offset: 0.2 },
          { opacity: 0, translate: '-50% -180%', scale: 1 },
        ],
        { duration: 900, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.then(() => $popup.remove());
  },

  updateElapsedTime() {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    $elapsedTime.textContent = this.formatElapsedTime(elapsed);
  },

  flash(feedbackType) {
    const color =
      feedbackType === FEEDBACK_CORRECT
        ? 'rgba(76, 175, 80, 0.3)'
        : 'rgba(244, 67, 54, 0.3)';
    const bg = `radial-gradient(circle, ${color}, transparent 70%)`;
    this.$flashOverlay.style.background = bg;
    this.$flashOverlay.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 400,
      easing: 'ease-out',
    });
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

    clearTimeout(this._feedbackTimer);
    $img.animate(
      [
        { opacity: 0, scale: 0.3 },
        { opacity: 1, scale: 1.2, offset: 0.4 },
        { scale: 0.95, offset: 0.7 },
        { opacity: 1, scale: 1 },
      ],
      { duration: 450, easing: 'ease-out' },
    );
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

    if ($screenEl !== $screenGameOver && $screenEl !== $screenMpResults) {
      stopConfetti();
    }

    if ($screenEl === $screenStart) {
      this.renderPreviewCard();
      this.startPreviewCycle();
      startAutoPlay($logoIcon, $logoContainer);
    } else {
      this.stopPreviewCycle();
      stopAutoPlay();
    }
  },

  startGame() {
    AudioManager.resume();

    // Generate and shuffle deck
    const { deck } = buildDeck(this.getCurrentSymbols());
    this.deck = Random.shuffle(deck);

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
    this.mpToggleHud(false);
  },

  renderCards() {
    const onSymbolClick = (symbol, $el) => this.handleSymbolClick(symbol, $el);
    const layoutOptions = {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
      useCustomEmojiImages: this.useCustomEmojiRender,
      emojiSetKey: this.selectedEmojiSetKey,
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

  playCardAnimation($cardEl, direction) {
    if (!$cardEl) return null;
    const keyframes = [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1.03) rotate(6deg)', opacity: 1, offset: 0.55 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
    ];
    return $cardEl.animate(
      direction === 'card-exit' ? [...keyframes].reverse() : keyframes,
      { duration: CARD_TRANSITION_DURATION_MS, easing: 'ease-out' },
    );
  },

  transitionToNextCards() {
    const $bottomContainer = $cardBottom.closest('.card-container');
    const $topContainer = $cardTop.closest('.card-container');

    // Calculate fly distance between card centers
    const topRect = $topContainer.getBoundingClientRect();
    const bottomRect = $bottomContainer.getBoundingClientRect();
    const offsetY =
      topRect.top +
      topRect.height / 2 -
      (bottomRect.top + bottomRect.height / 2);

    // Animate bottom card flying up to overlay the top card
    const flyAnimation = $cardBottom.animate(
      [
        { transform: 'translateY(0)', scale: 1, zIndex: 1 },
        { scale: 1.2, zIndex: 1, offset: 0.5 },
        { transform: `translateY(${offsetY}px)`, scale: 1, zIndex: 1 },
      ],
      { duration: CARD_FLY_DURATION_MS, easing: 'ease-in-out' },
    );

    flyAnimation.finished.then(() => {
      // Swap card data
      this.topCard = this.bottomCard;
      this.bottomCard = this.deck[this.currentCardIndex];

      // Render top card silently (visually same content that just flew up)
      const onSymbolClick = (symbol, $el) =>
        this.handleSymbolClick(symbol, $el);
      const layoutOptions = {
        rotationRangeDegrees: this.iconRotationDegrees,
        rotateByPosition: this.rotateByPosition,
        useCustomEmojiImages: this.useCustomEmojiRender,
        emojiSetKey: this.selectedEmojiSetKey,
      };
      positionEmojis(
        this.topCard,
        $cardTop,
        true,
        onSymbolClick,
        layoutOptions,
      );

      // Render new bottom card with enter animation
      positionEmojis(
        this.bottomCard,
        $cardBottom,
        true,
        onSymbolClick,
        layoutOptions,
      );
      this.playCardAnimation($cardBottom, 'card-enter');

      this.updateCardsRemaining();
      this.startCardTimer();
      this.isInputLocked = false;
    });
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
    this.mpToggleHud(false);
    $mpPlayersPanel.hidden = true;
    $abilitiesPanel.hidden = true;
    this.mpStopAbilitiesListener();
    $screenGameMenu.hidden = true;

    // Leave multiplayer room if in one
    if (Multiplayer.roomCode) {
      Multiplayer.leaveRoom();
    }
    localStorage.removeItem(MP_ROOM_CODE_KEY);

    this.showScreen($screenStart);
  },

  endGame(won) {
    this.isPlaying = false;
    this.isInputLocked = false;
    this.stopCardTimer();
    $screenGameMenu.hidden = true;

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
    if (won) launchConfetti();
  },

  resetProgress() {
    localStorage.removeItem('dobble_best_score');
    $screenResetConfirm.hidden = true;
  },

  showLeaderboard() {
    this.showScreen($screenLeaderboard);
    Leaderboard.render();
  },

  // ===== Avatar Picker =====
  renderAvatarPicker(selectedAvatar) {
    const $grid = document.getElementById('$avatarGrid');
    if (!$grid) return;

    $grid.innerHTML = '';
    EMOJIS_CLASSIC.forEach((emoji) => {
      const $btn = document.createElement('button');
      $btn.className = 'avatar-picker-item';
      $btn.dataset.emoji = emoji;
      if (emoji === selectedAvatar)
        $btn.classList.add('avatar-picker-item--selected');

      const html = renderAvatarHtml(emoji, this.useCustomEmojiRender);
      $btn.innerHTML = html;
      $grid.appendChild($btn);
    });

    // Update current avatar display
    const $current = document.getElementById('$avatarCurrent');
    if ($current) {
      $current.innerHTML = renderAvatarHtml(
        selectedAvatar,
        this.useCustomEmojiRender,
      );
    }
  },

  bindAvatarPicker() {
    const $grid = document.getElementById('$avatarGrid');
    if (!$grid) return;

    $grid.addEventListener('click', (e) => {
      const $btn = e.target.closest('.avatar-picker-item');
      if (!$btn) return;

      const emoji = $btn.dataset.emoji;
      if (!emoji) return;

      // Update selection
      $grid
        .querySelectorAll('.avatar-picker-item--selected')
        .forEach(($el) => $el.classList.remove('avatar-picker-item--selected'));
      $btn.classList.add('avatar-picker-item--selected');

      // Update current display
      const $current = document.getElementById('$avatarCurrent');
      if ($current) {
        $current.innerHTML = renderAvatarHtml(emoji, this.useCustomEmojiRender);
      }

      Profile.updateAvatar(emoji);
    });
  },

  // ===== Multiplayer Methods =====
  async mpCreateRoom() {
    // If already in a game, rejoin instead
    if (await this.mpCheckActiveGame()) return;

    try {
      const maxPlayers = parseInt($selectMaxPlayers.value, 10) || 2;
      const autoMatchmaking = $toggleAutoMatch.checked;

      const roomCode = await Multiplayer.createRoom({
        maxPlayers,
        autoMatchmaking,
        emojiSet: this.selectedEmojiSetKey,
      });

      this.mpEnterLobby(roomCode);
    } catch (err) {
      console.log('🎮 Create room error:', err);
    }
  },

  async mpJoinRoom() {
    // If already in a game, rejoin instead
    if (await this.mpCheckActiveGame()) return;

    const code = $inputRoomCode.value.trim();
    if (!code || code.length < 5) return;

    try {
      await Multiplayer.joinRoom(code);
      this.mpEnterLobby(code);
    } catch (err) {
      console.log('🎮 Join error:', err.message);
      const msgKey = {
        ROOM_NOT_FOUND: 'mp.roomNotFound',
        ROOM_FULL: 'mp.roomFull',
        GAME_ALREADY_STARTED: 'mp.gameStarted',
      }[err.message];
      if (msgKey) $lobbyStatus.textContent = t(msgKey);
    }
  },

  async mpFindGame() {
    // If already in a game, rejoin instead
    if (await this.mpCheckActiveGame()) return;

    try {
      $lobbyStatus.textContent = t('leaderboard.loading');
      const roomCode = await Multiplayer.findRoom();
      if (roomCode) {
        this.mpEnterLobby(roomCode);
      } else {
        // No rooms found — create one with autoMatchmaking
        $toggleAutoMatch.checked = true;
        await this.mpCreateRoom();
      }
    } catch (err) {
      console.log('🎮 Find game error:', err);
    }
  },

  async mpRefreshRoomStats() {
    try {
      const { total, available } = await Multiplayer.getRoomStats();
      $roomStatsCount.textContent = `${available} / ${total}`;
    } catch {
      $roomStatsCount.textContent = '–';
    }
  },

  mpEnterLobby(roomCode) {
    this._mpLetsPlayShowing = false;
    this._mpLetsPlayTimer = null;
    this._mpLobbyPrevUids = new Set();
    $lobbyLetsPlay.hidden = true;
    this.showScreen($screenLobby);
    $lobbyRoomCode.textContent = roomCode;
    $inputRoomCode.value = '';
    localStorage.setItem(MP_ROOM_CODE_KEY, roomCode);

    Multiplayer.onRoomUpdate = (data) => this.mpRenderLobby(data);
    Multiplayer.onPlayerLeft = (uid) => {
      console.log('🎮 Player timed out:', uid);
    };
  },

  mpRenderLobby(roomData) {
    if (!roomData) return;
    // Don't update lobby once Let's Play is showing
    if (this._mpLetsPlayShowing) return;

    const currentUid = auth?.currentUser?.uid;
    const players = roomData.players || {};
    const maxPlayers = roomData.maxPlayers || 2;

    // Sort: host first, then by joinedAt
    const playerEntries = Object.entries(players).sort(([uidA], [uidB]) => {
      if (uidA === roomData.hostUid) return -1;
      if (uidB === roomData.hostUid) return 1;
      return (players[uidA].joinedAt || 0) - (players[uidB].joinedAt || 0);
    });

    // Detect new and removed players
    const currentUids = new Set(playerEntries.map(([uid]) => uid));
    const prevUids = this._mpLobbyPrevUids || new Set();
    const newUids = new Set(
      [...currentUids].filter((uid) => !prevUids.has(uid)),
    );
    const removedUids = new Set(
      [...prevUids].filter((uid) => !currentUids.has(uid)),
    );
    this._mpLobbyPrevUids = currentUids;

    // Animate out removed players before rebuilding
    if (removedUids.size > 0) {
      const $$existing = $lobbyPlayersList.querySelectorAll(
        '.lobby-player[data-uid]',
      );
      const animations = [];
      $$existing.forEach(($row) => {
        if (removedUids.has($row.dataset.uid)) {
          const anim = $row.animate(
            [
              { opacity: 1, transform: 'translateX(0px)' },
              { opacity: 0, transform: 'translateX(-40px)' },
            ],
            { duration: 250, easing: 'ease-in', fill: 'forwards' },
          );
          animations.push(anim.finished);
        }
      });
      Promise.all(animations).then(() =>
        this._mpBuildLobbyList(
          roomData,
          playerEntries,
          maxPlayers,
          currentUid,
          newUids,
        ),
      );
    } else {
      this._mpBuildLobbyList(
        roomData,
        playerEntries,
        maxPlayers,
        currentUid,
        newUids,
      );
    }

    // Update status text
    const connectedCount = playerEntries.filter(([, p]) => p.connected).length;
    $lobbyStatus.textContent =
      t('mp.waitingPlayers') + ` (${connectedCount}/${maxPlayers})`;

    // Auto-start when room is full — show "Let's Play!" for everyone
    if (
      connectedCount >= maxPlayers &&
      roomData.status === 'waiting' &&
      !this._mpLetsPlayTimer &&
      !this._mpLetsPlayShowing
    ) {
      this._mpLetsPlayTimer = setTimeout(() => {
        this._mpLetsPlayTimer = null;
        this.mpShowLetsPlay(() => {
          if (Multiplayer.isHost) this.mpStartGame();
        });
      }, 2000);
    }

    // Cancel timer if room is no longer full
    if (connectedCount < maxPlayers && this._mpLetsPlayTimer) {
      clearTimeout(this._mpLetsPlayTimer);
      this._mpLetsPlayTimer = null;
    }

    // If game started by host, transition to game screen
    if (roomData.status === 'playing') {
      this.mpStartPlaying(roomData);
    }
  },

  _mpBuildLobbyList(roomData, playerEntries, maxPlayers, currentUid, newUids) {
    $lobbyPlayersList.innerHTML = '';

    playerEntries.forEach(([playerUid, playerData]) => {
      const $row = document.createElement('div');
      $row.className = 'lobby-player';
      $row.dataset.uid = playerUid;
      if (playerUid === currentUid) $row.classList.add('lobby-player--me');
      if (!playerData.connected)
        $row.classList.add('lobby-player--disconnected');

      const isHost = playerUid === roomData.hostUid;
      const avatarHtml = renderAvatarHtml(
        playerData.avatar,
        this.useCustomEmojiRender,
      );
      const statusEmoji = !playerData.connected ? '🔌' : '✅';
      const statusClass = !playerData.connected
        ? 'status-disconnected'
        : 'status-ready';
      const statusText = !playerData.connected
        ? t('mp.disconnected')
        : t('mp.ready');

      $row.innerHTML = `
        <span class="lobby-player-avatar">${avatarHtml}</span>
        ${isHost ? '<span class="lobby-player-crown">👑</span>' : ''}
        <span class="lobby-player-name">${playerData.displayName || 'Anonymous'}</span>
        <span class="lobby-player-status ${statusClass}">${statusEmoji} ${statusText}</span>
      `;

      $lobbyPlayersList.appendChild($row);

      // Animate new players in
      if (newUids.has(playerUid)) {
        $row.animate(
          [
            { opacity: 0, transform: 'translateX(40px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: 300, easing: 'ease-out' },
        );
      }
    });

    // Empty slots
    const emptySlots = maxPlayers - playerEntries.length;
    for (let i = 0; i < emptySlots; i++) {
      const $row = document.createElement('div');
      $row.className = 'lobby-player lobby-player--empty';
      $row.innerHTML = `
        <span class="lobby-player-avatar"><span class="avatar-emoji">👤</span></span>
        <span class="lobby-player-name">${t('mp.emptySlot')}</span>
      `;
      $lobbyPlayersList.appendChild($row);
    }
  },

  mpShowLetsPlay(onComplete) {
    this._mpLetsPlayShowing = true;
    const $overlay = $lobbyLetsPlay;
    const $text = $overlay.querySelector('.lobby-letsplay-text');
    $overlay.hidden = false;

    $text
      .animate(
        [
          { transform: 'scale(0.3)', opacity: 0 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.3 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 600, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.then(() => {
        setTimeout(() => {
          $overlay.hidden = true;
          this._mpLetsPlayShowing = false;
          onComplete();
        }, 1200);
      });
  },

  async mpStartGame() {
    if (!Multiplayer.isHost) return;
    try {
      const symbols = this.getCurrentSymbols();
      await Multiplayer.startGame(symbols);
    } catch (err) {
      console.log('🎮 Start game error:', err.message);
    }
  },

  mpToggleHud(isMultiplayer) {
    const $hudPanel = document.querySelector('.hud-panel');
    if ($hudPanel) $hudPanel.hidden = isMultiplayer;

    $mpPlayersPanel.hidden = !isMultiplayer;
    $mpCurrentPlayer.hidden = !isMultiplayer;
  },

  async mpTryRejoin() {
    const savedRoom = localStorage.getItem(MP_ROOM_CODE_KEY);
    if (!savedRoom) return;

    try {
      const roomData = await Multiplayer.rejoinRoom(savedRoom);
      console.log('🎮 Rejoin successful, status:', roomData.status);

      if (roomData.status === 'playing') {
        this.mpRejoinGame(roomData);
        return true;
      } else if (roomData.status === 'waiting') {
        this.mpEnterLobby(savedRoom);
        return true;
      }
    } catch (err) {
      console.log('🎮 Rejoin failed:', err.message);
      localStorage.removeItem(MP_ROOM_CODE_KEY);
    }
    return false;
  },

  async mpCheckActiveGame() {
    const savedRoom = localStorage.getItem(MP_ROOM_CODE_KEY);
    if (!savedRoom) return false;

    try {
      const roomData = await Multiplayer.rejoinRoom(savedRoom);
      if (roomData.status === 'playing') {
        this.mpRejoinGame(roomData);
      } else if (roomData.status === 'waiting') {
        this.mpEnterLobby(savedRoom);
      }
      return true;
    } catch {
      localStorage.removeItem(MP_ROOM_CODE_KEY);
      return false;
    }
  },

  mpRejoinGame(roomData) {
    this.mpLastRenderedRound = -1;
    this.mpLastPopupRound = -1;
    this.mpLastPlayerCard = null;
    this.mpLastWrongTaps = {};
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.startTime = Date.now();

    this.showScreen($screenGame);
    this.mpToggleHud(true);

    $mpPlayersPanel.hidden = false;
    this.mpRenderPlayersList(roomData);

    $abilitiesPanel.hidden = false;
    this.abilitySelected = null;
    this.abilityClockCooldown = false;
    $abilityClock.classList.remove(
      'ability-btn--selected',
      'ability-btn--cooldown',
    );

    // Jump straight into the game — no countdown
    this.isPlaying = true;
    this.isInputLocked = false;
    this._mpStartingGame = false;

    this.mpRenderCards(roomData);
    this.mpListenAbilities();

    Multiplayer.onRoomUpdate = (data) => {
      if (!data) return;
      if (data.status === 'finished') {
        this.mpGameOver(data);
        return;
      }
      this.mpRenderPlayersList(data);
      this.mpShowRoundPopup(data);
      this.mpShowWrongTapPopup(data);
      this.mpRenderCards(data);
    };

    console.log('🎮 Rejoined active game');
  },

  mpStartPlaying(roomData) {
    // Prevent re-entry if already started
    if (this._mpStartingGame) return;
    this._mpStartingGame = true;

    this.mpLastRenderedRound = -1;
    this.mpLastPopupRound = -1;
    this.mpLastPlayerCard = null;
    this.mpLastWrongTaps = {};
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.startTime = Date.now();
    this.isInputLocked = true;

    this.showScreen($screenGame);
    this.mpToggleHud(true);

    // Show player list panel
    $mpPlayersPanel.hidden = false;
    this.mpRenderPlayersList(roomData);

    // Show abilities panel
    $abilitiesPanel.hidden = false;
    this.abilitySelected = null;
    this.abilityClockCooldown = false;
    $abilityClock.classList.remove(
      'ability-btn--selected',
      'ability-btn--cooldown',
    );

    // Show countdown then start
    this.mpShowCountdown(() => {
      this.isPlaying = true;
      this.isInputLocked = false;
      this._mpStartingGame = false;

      // Render initial cards
      this.mpRenderCards(roomData);

      // Listen for incoming abilities
      this.mpListenAbilities();

      // Listen for further updates
      Multiplayer.onRoomUpdate = (data) => {
        if (!data) return;
        if (data.status === 'finished') {
          this.mpGameOver(data);
          return;
        }
        this.mpRenderPlayersList(data);
        this.mpShowRoundPopup(data);
        this.mpShowWrongTapPopup(data);
        this.mpRenderCards(data);
      };
    });
  },

  mpShowCountdown(onComplete) {
    const $overlay = $countdownOverlay;
    const $number = $countdownNumber;
    $overlay.hidden = false;

    const steps = ['3', '2', '1', 'GO!'];
    let index = 0;

    const showNext = () => {
      if (index >= steps.length) {
        $overlay.hidden = true;
        onComplete();
        return;
      }

      $number.textContent = steps[index];
      $number
        .animate(
          [
            { transform: 'scale(0.3)', opacity: 0 },
            { transform: 'scale(1.1)', opacity: 1, offset: 0.4 },
            { transform: 'scale(1)', opacity: 1, offset: 0.6 },
            { transform: 'scale(1)', opacity: 0 },
          ],
          { duration: 800, easing: 'ease-out', fill: 'forwards' },
        )
        .finished.then(() => {
          index++;
          showNext();
        });
    };

    showNext();
  },

  mpRenderPlayersList(roomData) {
    if (!roomData?.players) return;

    const currentUid = auth?.currentUser?.uid;
    const players = roomData.players;
    const $list = $mpPlayersList;
    $list.innerHTML = '';
    $mpCurrentPlayer.innerHTML = '';

    const sorted = Object.entries(players).sort(
      ([, a], [, b]) => (b.cardsWon || 0) - (a.cardsWon || 0),
    );

    sorted.forEach(([uid, data]) => {
      const avatarHtml = renderAvatarHtml(
        data.avatar,
        this.useCustomEmojiRender,
      );

      if (uid === currentUid) {
        $mpCurrentPlayer.innerHTML = `
          <span class="mp-player-avatar">${avatarHtml}</span>
          <span class="mp-player-name">${data.displayName || 'Anonymous'}</span>
          <span class="mp-player-score">${data.cardsWon || 0}</span>
        `;
        $mpCurrentPlayer.hidden = false;
      } else {
        const $row = document.createElement('div');
        $row.className = 'mp-player-row';
        $row.dataset.uid = uid;
        if (!data.connected) $row.classList.add('mp-player-row--disconnected');

        $row.innerHTML = `
          <span class="mp-player-avatar">${avatarHtml}</span>
          <span class="mp-player-name">${data.displayName || 'Anonymous'}</span>
          <span class="mp-player-score">${data.cardsWon || 0}</span>
        `;
        $list.appendChild($row);
      }
    });
  },

  mpRenderCards(roomData) {
    const cards = Multiplayer.getCurrentCards(roomData);
    if (!cards) return;

    const uid = auth?.currentUser?.uid;
    const myData = roomData.players?.[uid];
    if (myData) {
      this.score = myData.cardsWon || 0;
      $currentScore.textContent = this.score;
    }

    $cardsRemaining.textContent = `${cards.currentRound} / ${cards.totalRounds}`;

    // Skip re-render if same round already drawn (avoids flicker from intermediate DB updates)
    if (cards.currentRound === this.mpLastRenderedRound) return;

    const isFirstRender = this.mpLastRenderedRound === -1;
    const playerCardChanged =
      !this.mpLastPlayerCard ||
      JSON.stringify(this.mpLastPlayerCard) !==
        JSON.stringify(cards.playerCard);
    this.mpLastRenderedRound = cards.currentRound;
    this.mpLastPlayerCard = cards.playerCard;

    const roomSeed = stringToSeed(Multiplayer.roomCode || '');
    const layoutOptions = {
      rotationRangeDegrees: this.iconRotationDegrees,
      rotateByPosition: this.rotateByPosition,
      useCustomEmojiImages: this.useCustomEmojiRender,
      emojiSetKey: this.selectedEmojiSetKey,
    };

    const renderNewCards = () => {
      if (cards.isPlayerDone) {
        positionEmojis(cards.centralCard, $cardTop, false, null, {
          ...layoutOptions,
          seed: cardToSeed(cards.centralCard) ^ roomSeed,
        });
        $cardBottom.innerHTML =
          '<span style="font-size:2rem;opacity:0.5">⏳</span>';
        this.playCardAnimation($cardTop, 'card-enter');
        return;
      }

      const onSymbolClick = (symbol, $el) => this.mpTapSymbol(symbol, $el);

      // Central card (top) — not clickable, seed shared across all players
      positionEmojis(cards.centralCard, $cardTop, false, null, {
        ...layoutOptions,
        seed: cardToSeed(cards.centralCard) ^ roomSeed,
      });
      // Player card (bottom) — clickable, seed shared across all players
      positionEmojis(cards.playerCard, $cardBottom, true, onSymbolClick, {
        ...layoutOptions,
        seed: cardToSeed(cards.playerCard) ^ roomSeed,
      });

      this.playCardAnimation($cardTop, 'card-enter');
      if (playerCardChanged) {
        this.playCardAnimation($cardBottom, 'card-enter');
      }
    };

    if (isFirstRender) {
      renderNewCards();
    } else if (playerCardChanged) {
      // Current player won — top card flies down onto bottom card
      this.mpFlyTopCardDown().then(renderNewCards);
    } else {
      // Another player won — top card flies up off screen
      this.mpFlyTopCardOffScreen().then(renderNewCards);
    }
  },

  // Top card flies down to overlay the bottom card (current player won)
  mpFlyTopCardDown() {
    const $topContainer = $cardTop.closest('.card-container');
    const $bottomContainer = $cardBottom.closest('.card-container');

    const topRect = $topContainer.getBoundingClientRect();
    const bottomRect = $bottomContainer.getBoundingClientRect();
    const offsetY =
      bottomRect.top +
      bottomRect.height / 2 -
      (topRect.top + topRect.height / 2);

    const flyAnimation = $cardTop.animate(
      [
        { transform: 'translateY(0)', scale: 1, zIndex: 1 },
        { scale: 1.2, zIndex: 1, offset: 0.5 },
        { transform: `translateY(${offsetY}px)`, scale: 1, zIndex: 1 },
      ],
      { duration: CARD_FLY_DURATION_MS, easing: 'ease-in-out' },
    );

    return flyAnimation.finished;
  },

  // Top card flies up off screen (opponent won)
  mpFlyTopCardOffScreen() {
    const $topContainer = $cardTop.closest('.card-container');
    const topRect = $topContainer.getBoundingClientRect();

    // Fly up past the top of the viewport
    const offsetY = -(topRect.top + topRect.height);

    const flyAnimation = $cardTop.animate(
      [
        { transform: 'translateY(0)', scale: 1, opacity: 1 },
        { transform: `translateY(${offsetY}px)`, scale: 0.8, opacity: 0 },
      ],
      { duration: CARD_FLY_DURATION_MS, easing: 'ease-in' },
    );

    return flyAnimation.finished;
  },

  renderCardSymbols($card, symbols, isClickable) {
    // Kept for backwards compat — multiplayer now uses mpRenderCards
    if (!$card || !symbols) return;
  },

  mpShowRoundPopup(roomData) {
    const game = roomData.game;
    if (!game) return;

    const currentRound = game.currentRound || 0;
    const prevRound = currentRound - 1;
    if (prevRound < 0 || prevRound <= this.mpLastPopupRound) return;

    const roundData = roomData.rounds?.[prevRound];
    if (!roundData) return;

    this.mpLastPopupRound = prevRound;
    const currentUid = auth?.currentUser?.uid;
    const winnerId = roundData.winnerId;
    const winnerName = roomData.players?.[winnerId]?.displayName || '???';

    if (winnerId === currentUid) {
      // Current player won this round
      this.showScorePopup(1);
    } else {
      // Opponent won — show their name
      this.mpShowOpponentPopup(winnerName);
    }
  },

  mpShowOpponentPopup(name) {
    const $popup = document.createElement('div');
    $popup.classList.add('score-popup', 'score-negative');
    $popup.textContent = `${name} 🎯`;

    const $gameArea = document.querySelector('.game-area');
    $gameArea.appendChild($popup);

    $popup
      .animate(
        [
          { opacity: 1, translate: '-50% -50%', scale: 0.6 },
          { opacity: 1, scale: 1.15, offset: 0.2 },
          { opacity: 0, translate: '-50% -180%', scale: 1 },
        ],
        { duration: 900, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.then(() => $popup.remove());
  },

  mpShowWrongTapPopup(roomData) {
    const wrongTaps = roomData.wrongTaps;
    if (!wrongTaps) return;

    const currentUid = auth?.currentUser?.uid;

    for (const [uid, timestamp] of Object.entries(wrongTaps)) {
      if (uid === currentUid) continue;
      if (timestamp <= (this.mpLastWrongTaps[uid] || 0)) continue;

      this.mpLastWrongTaps[uid] = timestamp;
      const name = roomData.players?.[uid]?.displayName || '???';

      const $popup = document.createElement('div');
      $popup.classList.add('score-popup', 'score-negative');
      $popup.textContent = `${name} ❌`;

      const $gameArea = document.querySelector('.game-area');
      $gameArea.appendChild($popup);

      $popup
        .animate(
          [
            { opacity: 1, translate: '-50% -50%', scale: 0.6 },
            { opacity: 1, scale: 1.15, offset: 0.2 },
            { opacity: 0, translate: '-50% -180%', scale: 1 },
          ],
          { duration: 900, easing: 'ease-out', fill: 'forwards' },
        )
        .finished.then(() => $popup.remove());

      // Clear the wrong tap after showing
      setTimeout(() => {
        const wrongRef = ref(
          rtdb,
          `rooms/${Multiplayer.roomCode}/wrongTaps/${uid}`,
        );
        remove(wrongRef);
      }, 1000);
    }
  },

  async mpTapSymbol(symbol, $el) {
    if (this.isInputLocked) return;
    this.isInputLocked = true;

    const claimed = await Multiplayer.claimRound(symbol);

    if (claimed) {
      $el.classList.add(FEEDBACK_CORRECT);
      this.flash(FEEDBACK_CORRECT);
      this.showFeedbackIcon(FEEDBACK_CORRECT);
      AudioManager.play(FEEDBACK_CORRECT);
      setTimeout(() => {
        this.isInputLocked = false;
      }, CARD_TRANSITION_DURATION_MS);
    } else {
      $el.classList.add(FEEDBACK_WRONG);
      this.flash(FEEDBACK_WRONG);
      this.showFeedbackIcon(FEEDBACK_WRONG);
      AudioManager.play(FEEDBACK_WRONG);
      Multiplayer.reportWrongTap();

      // Penalty: lock input + grayscale on player's card
      $cardBottom.classList.add('card-penalty');
      setTimeout(() => {
        $cardBottom.classList.remove('card-penalty');
        this.isInputLocked = false;
      }, MP_WRONG_PENALTY_MS);
    }
  },

  mpGameOver(roomData) {
    this.isPlaying = false;
    this.mpToggleHud(false);
    $mpPlayersPanel.hidden = true;
    $abilitiesPanel.hidden = true;
    this.mpStopAbilitiesListener();
    localStorage.removeItem(MP_ROOM_CODE_KEY);
    Multiplayer.cleanup();

    // Sort players by cardsWon
    const players = roomData.players || {};
    const sorted = Object.entries(players).sort(
      ([, a], [, b]) => (b.cardsWon || 0) - (a.cardsWon || 0),
    );

    const uid = auth?.currentUser?.uid;
    const winnerName = sorted[0]?.[1]?.displayName || '???';
    const isWinner = sorted[0]?.[0] === uid;

    // Show winner announcement with countdown overlay
    const $overlay = $countdownOverlay;
    const $number = $countdownNumber;
    $overlay.hidden = false;

    const winnerText = isWinner
      ? t('gameover.win')
      : `${winnerName} ${t('mp.wins')}`;
    $number.textContent = winnerText;

    if (isWinner) launchConfetti();

    $number
      .animate(
        [
          { transform: 'scale(0.3)', opacity: 0 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.3 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 600, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.then(() => {
        setTimeout(() => {
          $overlay.hidden = true;
          stopConfetti();
          this.mpShowResults(sorted, uid);
        }, 2000);
      });
  },

  mpShowResults(sorted, currentUid) {
    const placeEmojis = ['🥇', '🥈', '🥉'];

    $mpResultsTitle.textContent = `🏆 ${t('mp.results')}`;
    $mpResultsList.innerHTML = '';

    sorted.forEach(([uid, data], index) => {
      const $row = document.createElement('div');
      $row.className = 'mp-result-row';
      if (index === 0) $row.classList.add('mp-result-row--winner');
      if (uid === currentUid) $row.classList.add('mp-result-row--me');

      const placeIcon = placeEmojis[index] || `${index + 1}`;
      const avatarHtml = renderAvatarHtml(
        data.avatar,
        this.useCustomEmojiRender,
      );

      $row.innerHTML = `
        <span class="mp-result-place">${placeIcon}</span>
        <span class="mp-result-avatar">${avatarHtml}</span>
        <span class="mp-result-name">${data.displayName || 'Anonymous'}</span>
        <span class="mp-result-cards">
          <span class="mp-result-cards-icon">🃏</span>
          ${data.cardsWon || 0}
        </span>
      `;
      $mpResultsList.appendChild($row);
    });

    this.showScreen($screenMpResults);
  },

  async mpCopyCode() {
    const code = $lobbyRoomCode.textContent;
    try {
      await navigator.clipboard.writeText(code);
      $btnCopyCode.textContent = t('mp.copied');
      setTimeout(() => {
        $btnCopyCode.textContent = t('mp.copyCode');
      }, 2000);
    } catch {
      // Fallback
      $inputRoomCode.value = code;
      $inputRoomCode.select();
    }
  },

  async mpLeaveRoom() {
    if (this._mpLetsPlayTimer) {
      clearTimeout(this._mpLetsPlayTimer);
      this._mpLetsPlayTimer = null;
    }
    localStorage.removeItem(MP_ROOM_CODE_KEY);
    await Multiplayer.leaveRoom();
    this.showScreen($screenMultiplayer);
  },

  toggleSound() {
    const enabled = AudioManager.toggle();
    $toggleSound.checked = enabled;
  },

  // ===== Abilities =====
  abilitySelectClock() {
    if (this.abilityClockCooldown) return;

    if (this.abilitySelected === 'clock') {
      // Deselect
      this.abilityCancelSelection();
      return;
    }

    this.abilitySelected = 'clock';
    $abilityClock.classList.add('ability-btn--selected');

    // Mark other players as targetable
    const currentUid = auth?.currentUser?.uid;
    $mpPlayersList.querySelectorAll('.mp-player-row').forEach(($row) => {
      if (DEBUG_ABILITIES || $row.dataset.uid !== currentUid) {
        $row.classList.add('ability-targetable');
      }
    });
  },

  abilityCancelSelection() {
    this.abilitySelected = null;
    $abilityClock.classList.remove('ability-btn--selected');
    $mpPlayersList.querySelectorAll('.mp-player-row').forEach(($row) => {
      $row.classList.remove('ability-targetable');
    });
  },

  async abilityUseOnPlayer(targetUid) {
    if (!this.abilitySelected || !targetUid) return;
    const currentUid = auth?.currentUser?.uid;
    if (!DEBUG_ABILITIES && targetUid === currentUid) return;

    const ability = this.abilitySelected;
    this.abilityCancelSelection();

    if (ability === 'clock') {
      this.abilityClockCooldown = true;
      $abilityClock.classList.add('ability-btn--cooldown');
      this.startAbilityCooldownProgress(ABILITY_CLOCK_DURATION_MS);

      // Send ability via Firebase
      const abilityRef = ref(
        rtdb,
        `rooms/${Multiplayer.roomCode}/abilities/${targetUid}`,
      );
      await set(abilityRef, {
        type: 'clock',
        from: currentUid,
        timestamp: Date.now(),
      });

      console.log('⏰ Clock ability sent to', targetUid);

      // Remove after a short delay so the listener picks it up
      setTimeout(() => {
        remove(abilityRef);
      }, 2000);

      // Cooldown timer
      setTimeout(() => {
        this.abilityClockCooldown = false;
        $abilityClock.classList.remove('ability-btn--cooldown');
        if (this.$abilityClockProgress) {
          this.$abilityClockProgress.style.strokeDashoffset = '150.8';
        }
      }, ABILITY_CLOCK_DURATION_MS);
    }
  },

  mpListenAbilities() {
    const uid = auth?.currentUser?.uid;
    if (!uid || !Multiplayer.roomCode) return;

    const abilityRef = ref(
      rtdb,
      `rooms/${Multiplayer.roomCode}/abilities/${uid}`,
    );

    this._abilityListener = rtdbOnValue(abilityRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.type === 'clock') {
        this.abilityApplyClock();
      }
    });
  },

  mpStopAbilitiesListener() {
    if (this._abilityListener) {
      this._abilityListener();
      this._abilityListener = null;
    }
  },

  abilityApplyClock() {
    console.log('⏰ Clock ability received! Spinning card...');
    const $card = $cardBottom;

    // Phase 1: spin the whole card
    $card.classList.add('ability-clock-spin');

    // Phase 2: after card spin, spin individual emojis
    const onSpinEnd = () => {
      $card.classList.remove('ability-clock-spin');
    };
    $card.addEventListener('animationend', onSpinEnd, { once: true });
  },

  startAbilityCooldownProgress(durationMs) {
    if (!this.$abilityClockProgress) return;

    const startTime = Date.now();
    const totalDash = 150.8; // full circle

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const dashOffset = totalDash * (1 - progress); // from 150.8 to 0

      this.$abilityClockProgress.style.strokeDashoffset = dashOffset;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  },
};

// ===== Start =====
document.addEventListener('DOMContentLoaded', () => {
  initCardRings();
  Game.init();

  // Wait for auth, then rejoin or show start screen
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const rejoined = await Game.mpTryRejoin();
    if (!rejoined) {
      $screenLoading.hidden = true;
      Game.showScreen($screenStart);
    }
  });
});
