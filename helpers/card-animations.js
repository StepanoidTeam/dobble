// ===== Card Transition Animations =====
// Shared by solo and multiplayer game modes.

export const CARD_FLY_DURATION_MS = 500;

/**
 * 3D arc fly from $card position down to $target position.
 * Adds 'card-flying' class for z-index stacking.
 * Returns Animation (fill: 'forwards' — caller must cancel after role swap).
 */
export function flyCardDown($card, $target) {
  const topRect = $card.getBoundingClientRect();
  const bottomRect = $target.getBoundingClientRect();
  const offsetY =
    bottomRect.top + bottomRect.height / 2 - (topRect.top + topRect.height / 2);

  $card.classList.add('card-flying');
  return $card.$circle.animate(
    [
      {
        transform:
          'translateY(0) translateZ(0) scale(1) rotateX(0deg) rotateZ(0deg)',
      },
      {
        transform:
          'translateY(0) translateZ(80px) scale(1.1) rotateX(-15deg) rotateZ(-6deg)',
        offset: 0.2,
      },
      {
        transform: `translateY(${offsetY * 0.5}px) translateZ(120px) scale(1.12) rotateX(0deg) rotateZ(0deg)`,
        offset: 0.5,
      },
      {
        transform: `translateY(${offsetY}px) translateZ(40px) scale(1.05) rotateX(10deg) rotateZ(4deg)`,
        offset: 0.8,
      },
      {
        transform: `translateY(${offsetY}px) translateZ(0) scale(1) rotateX(0deg) rotateZ(0deg)`,
      },
    ],
    { duration: CARD_FLY_DURATION_MS, easing: 'ease-in-out', fill: 'forwards' },
  );
}

/**
 * Fly card up past the top of the viewport (opponent won).
 * Returns Animation (fill: 'forwards' — caller must cancel after role swap).
 */
export function flyCardOffScreen($card) {
  const topRect = $card.getBoundingClientRect();
  const offsetY = -(topRect.top + topRect.height);

  $card.classList.add('card-flying');
  return $card.$circle.animate(
    [
      { transform: 'translateY(0)', scale: 1, opacity: 1 },
      { transform: `translateY(${offsetY}px)`, scale: 0.8, opacity: 0 },
    ],
    { duration: CARD_FLY_DURATION_MS, easing: 'ease-in', fill: 'forwards' },
  );
}

/**
 * Shake a card on wrong tap.
 */
export function shakeCard($el) {
  const $card = $el.closest('dobble-card');
  if (!$card) return;
  $card.$circle.animate(
    [
      { transform: 'translateX(0) rotateZ(0deg)' },
      { transform: 'translateX(0) rotateZ(-5deg)', offset: 0.3 },
      { transform: 'translateX(0) rotateZ(5deg)', offset: 0.6 },
      { transform: 'translateX(0) rotateZ(-5deg)', offset: 0.8 },
      { transform: 'translateX(0) rotateZ(0deg)' },
    ],
    { duration: 500, easing: 'ease-out' },
  );
}

/**
 * Position the buffer card exactly over the deck card and reveal it
 * with an enter animation. Buffer must already have its content set.
 */
export function revealBufferOverDeck($buffer, $deck) {
  const deckRect = $deck.getBoundingClientRect();
  const areaRect = $deck.parentElement.getBoundingClientRect();
  $buffer.style.top = `${deckRect.top - areaRect.top}px`;
  $buffer.style.left = `${deckRect.left - areaRect.left}px`;
  $buffer.style.width = `${deckRect.width}px`;
  $buffer.style.height = `${deckRect.height}px`;
  $buffer.style.visibility = 'visible';
  $buffer.playAnimation('card-enter');
}
