// ===== <dobble-card> Web Component =====
// Light DOM card with auto-generated ring SVG and emoji circle.
// Usage: <dobble-card id="$cardTop" class="card-top"></dobble-card>
// Access .$circle for the inner card-circle element, .$ring for the ring.

import {
  positionEmojis,
  setCardRingSegments,
  updateRingProgress,
} from '../helpers/ui-utils.js';

const CARD_TRANSITION_DURATION_MS = 250;

class DobbleCard extends HTMLElement {
  connectedCallback() {
    this.classList.add('card-container');

    // Ring SVG
    this.$ring = this._createRing();
    this.appendChild(this.$ring);

    // Card circle (where emojis go)
    this.$circle = document.createElement('div');
    this.$circle.classList.add('card-circle');
    this.appendChild(this.$circle);

    this._initRingSegments();
  }

  _createRing() {
    const $ring = document.createElement('div');
    $ring.classList.add('card-ring');
    $ring.setAttribute('aria-hidden', 'true');
    $ring.innerHTML = `
      <svg class="card-ring-svg" viewBox="0 0 100 100" focusable="false">
        <circle class="card-ring-track" cx="50" cy="50" r="46" pathLength="100"></circle>
        <circle class="card-ring-segment ring-segment-a" cx="50" cy="50" r="46" pathLength="100"></circle>
        <circle class="card-ring-segment ring-segment-b" cx="50" cy="50" r="46" pathLength="100"></circle>
      </svg>`;
    return $ring;
  }

  _initRingSegments() {
    setCardRingSegments(this.$ring, {
      firstLength: 18,
      firstStart: 8,
      secondLength: 18,
      secondStart: 58,
    });
  }

  setEmojis(card, isClickable, onSymbolClick, layoutOptions) {
    positionEmojis(
      card,
      this.$circle,
      isClickable,
      onSymbolClick,
      layoutOptions,
    );
  }

  setContent(html) {
    this.$circle.innerHTML = html;
  }

  setRingSegments(config) {
    setCardRingSegments(this.$ring, config);
  }

  updateRingProgress(remaining) {
    updateRingProgress(this.$ring, remaining);
  }

  playAnimation(direction) {
    if (!this.$circle) return null;
    const keyframes = [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1.03) rotate(6deg)', opacity: 1, offset: 0.55 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
    ];
    return this.$circle.animate(
      direction === 'card-exit' ? [...keyframes].reverse() : keyframes,
      { duration: CARD_TRANSITION_DURATION_MS, easing: 'ease-out' },
    );
  }

  animateCircle(keyframes, options) {
    return this.$circle.animate(keyframes, options);
  }
}

customElements.define('dobble-card', DobbleCard);
