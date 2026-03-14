// ===== Dobble Game Engine =====

import { ALL_SYMBOLS as BASE_SYMBOLS } from './emojis-claude.js';
import { ALL_SYMBOLS as ORIGIN_SYMBOLS } from './emojis-origin.js';

const EMOJI_SET_STORAGE_KEY = 'dobble_emoji_set';
const TIME_PER_CARD_STORAGE_KEY = 'dobble_time_per_card_ms';
const TIME_PER_CARD_MIN_SECONDS = 5;
const TIME_PER_CARD_MAX_SECONDS = 100;
const TIME_PER_CARD_STEP_SECONDS = 5;
const DEFAULT_TIME_PER_CARD_MS = 10000;
const EMOJI_SETS = {
  base: {
    key: 'base',
    label: `${BASE_SYMBOLS.at(0)}Базовый`,
    symbols: BASE_SYMBOLS,
  },
  origin: {
    key: 'origin',
    label: `${ORIGIN_SYMBOLS.at(0)}Классический`,
    symbols: ORIGIN_SYMBOLS,
  },
};

(function () {
  'use strict';
  // ===== Symbol Pool (emojis) =====

  // ===== Dobble Card Generation =====
  // Dobble uses a projective plane of order n.
  // For 8 symbols per card, n = 7.
  // Total symbols needed: n^2 + n + 1 = 57
  // Total cards: 57
  // Each card has n + 1 = 8 symbols
  // Any two cards share exactly 1 symbol

  function generateDobbleCards(order) {
    const n = order; // 7
    const totalSymbols = n * n + n + 1; // 57
    const symbolsPerCard = n + 1; // 8
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

    return { cards, totalSymbols, symbolsPerCard };
  }

  // Build deck with actual emoji symbols
  function buildDeck(symbols) {
    const { cards } = generateDobbleCards(7);
    const safeSymbols =
      symbols && symbols.length >= 57 ? symbols : BASE_SYMBOLS;

    // Map indices to emojis
    return cards.map((card) => card.map((idx) => safeSymbols[idx]));
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

  // ===== Position emojis in a circle layout =====
  function positionEmojis(card, containerEl, isClickable, onSymbolClick) {
    containerEl.innerHTML = '';

    const shuffledCard = shuffle(card);
    const count = shuffledCard.length;

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
      const rotation = -20 + Math.random() * 40;
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

  // ===== Audio Manager =====
  const AudioManager = {
    enabled: true,
    ctx: null,

    init() {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.enabled = false;
      }
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    play(type) {
      if (!this.enabled || !this.ctx) return;
      this.resume();

      if (type === 'correct') {
        const popOsc = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        popOsc.type = 'sine';
        popOsc.connect(popGain);
        popGain.connect(this.ctx.destination);

        popOsc.frequency.setValueAtTime(720, this.ctx.currentTime);
        popOsc.frequency.exponentialRampToValueAtTime(
          180,
          this.ctx.currentTime + 0.09,
        );
        popGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(
          0.2,
          this.ctx.currentTime + 0.01,
        );
        popGain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.11,
        );

        const sparkleOsc = this.ctx.createOscillator();
        const sparkleGain = this.ctx.createGain();
        sparkleOsc.type = 'triangle';
        sparkleOsc.connect(sparkleGain);
        sparkleGain.connect(this.ctx.destination);
        sparkleOsc.frequency.setValueAtTime(980, this.ctx.currentTime + 0.02);
        sparkleOsc.frequency.exponentialRampToValueAtTime(
          620,
          this.ctx.currentTime + 0.09,
        );
        sparkleGain.gain.setValueAtTime(0.001, this.ctx.currentTime + 0.02);
        sparkleGain.gain.exponentialRampToValueAtTime(
          0.08,
          this.ctx.currentTime + 0.04,
        );
        sparkleGain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.1,
        );

        popOsc.start(this.ctx.currentTime);
        popOsc.stop(this.ctx.currentTime + 0.12);
        sparkleOsc.start(this.ctx.currentTime + 0.02);
        sparkleOsc.stop(this.ctx.currentTime + 0.1);
      } else if (type === 'wrong') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(170, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          95,
          this.ctx.currentTime + 0.18,
        );
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.2,
          this.ctx.currentTime + 0.01,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.2,
        );
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.22);
      } else if (type === 'gameover') {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.connect(g);
          g.connect(this.ctx.destination);
          o.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.15);
          g.gain.setValueAtTime(0.12, this.ctx.currentTime + i * 0.15);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            this.ctx.currentTime + i * 0.15 + 0.3,
          );
          o.start(this.ctx.currentTime + i * 0.15);
          o.stop(this.ctx.currentTime + i * 0.15 + 0.3);
        });
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    },
  };

  // ===== Game State =====
  const Game = {
    deck: [],
    selectedEmojiSetKey: 'base',
    currentCardIndex: 0,
    topCard: null,
    bottomCard: null,
    score: 0,
    startTime: 0,
    timerInterval: null,
    timePerCard: DEFAULT_TIME_PER_CARD_MS,
    cardStartTime: 0,
    pausedCardElapsed: 0,
    gameCardRings: [],
    isPlaying: false,
    totalCardsInGame: 20, // number of card pairs to play

    init() {
      this.loadEmojiSetPreference();
      this.loadTimerPreference();
      this.populateEmojiSetOptions();
      this.syncSettingsControls();
      this.bindEvents();
      AudioManager.init();
      this.createFlashOverlay();
      this.cacheGameCardRings();
      this.renderPreviewCard();
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

    populateEmojiSetOptions() {
      if (!emojiSetSelect) return;

      emojiSetSelect.innerHTML = '';
      Object.values(EMOJI_SETS).forEach((setConfig) => {
        const option = document.createElement('option');
        option.value = setConfig.key;
        option.textContent = setConfig.label;
        emojiSetSelect.appendChild(option);
      });

      emojiSetSelect.value = this.selectedEmojiSetKey;
    },

    loadEmojiSetPreference() {
      const savedSetKey = localStorage.getItem(EMOJI_SET_STORAGE_KEY);
      if (savedSetKey && EMOJI_SETS[savedSetKey]) {
        this.selectedEmojiSetKey = savedSetKey;
      }
    },

    loadTimerPreference() {
      const rawValue = localStorage.getItem(TIME_PER_CARD_STORAGE_KEY);
      const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
      if (Number.isNaN(parsedValue)) return;

      const normalizedSeconds = snapTimerSeconds(
        Math.round(parsedValue / 1000),
      );
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
      if (timerRange) {
        timerRange.value = `${snappedSeconds}`;
      }
    },

    updateTimerDisplay(seconds) {
      if (!timerValue) return;
      timerValue.textContent = `${seconds} с`;
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
      }

      this.updateTimerDisplay(this.getTimePerCardSeconds());
    },

    getCurrentSymbols() {
      const setConfig = EMOJI_SETS[this.selectedEmojiSetKey] || EMOJI_SETS.base;
      return setConfig.symbols;
    },

    bindEvents() {
      btnPlay.addEventListener('click', () => this.startGame());
      btnHowTo.addEventListener('click', () => this.showScreen(screenHowTo));
      btnOpenSettings.addEventListener('click', () => this.openSettings());
      btnBackHowTo.addEventListener('click', () =>
        this.showScreen(screenStart),
      );
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
          const nextValue = parseInt(e.target.value, 10);
          if (Number.isNaN(nextValue)) return;
          this.applyTimePerCardSeconds(nextValue);
        });
      }

      if (!emojiSetSelect) return;

      emojiSetSelect.addEventListener('change', (e) => {
        const nextSetKey = e.target.value;
        if (!EMOJI_SETS[nextSetKey]) return;

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

    renderPreviewCard() {
      const previewSymbols = shuffle(this.getCurrentSymbols()).slice(0, 8);
      positionEmojis(previewSymbols, cardPreview, false);
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
    },

    startGame() {
      AudioManager.resume();

      // Generate and shuffle deck
      this.deck = shuffle(buildDeck(this.getCurrentSymbols()));

      // Limit to totalCardsInGame + 1 cards (need pairs)
      this.deck = this.deck.slice(0, this.totalCardsInGame + 1);

      this.currentCardIndex = 1;
      this.score = 0;
      this.startTime = Date.now();
      this.pausedCardElapsed = 0;
      this.isPlaying = true;

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
      // Top card — not clickable
      positionEmojis(this.topCard, cardTop, false);

      // Bottom card — clickable
      positionEmojis(this.bottomCard, cardBottom, true, (symbol, el) => {
        this.handleSymbolClick(symbol, el);
      });

      // Animate new cards
      cardTop.classList.remove('card-enter');
      void cardTop.offsetWidth;
      cardTop.classList.add('card-enter');
    },

    handleSymbolClick(symbol, el) {
      if (!this.isPlaying) return;

      const commonSymbol = findCommonSymbol(this.topCard, this.bottomCard);

      if (symbol === commonSymbol) {
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

      const initialRemaining = Math.max(
        0,
        1 - initialElapsed / this.timePerCard,
      );
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
      clearInterval(this.timerInterval);
      this.pausedCardElapsed = 0;
      screenExitConfirm.classList.remove('active');
      this.showScreen(screenStart);
    },

    endGame(won) {
      this.isPlaying = false;
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
})();
