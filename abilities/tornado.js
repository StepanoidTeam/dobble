// ===== Tornado Ability =====

export const DURATION_MS = 5000;
export const COOLDOWN_MS = 5000;
export const ICON = '🌪️';
export const KEY = 'tornado';

export function animate($circle) {
  // Card spins — smooth deceleration
  $circle.animate(
    [
      { transform: `rotate(${0}deg) scale(1)` },
      { transform: `rotate(${360 * 7}deg) scale(1)` },
    ],
    { duration: DURATION_MS, easing: 'cubic-bezier(0, 0.55, 0.1, 1)' },
  );

  // Blur + brightness
  $circle.animate(
    [
      { filter: 'blur(0px) brightness(1)' },
      { filter: 'blur(3px) brightness(1.2)', offset: 0.3 },
      { filter: 'blur(1px) brightness(0.9)', offset: 0.7 },
      { filter: 'blur(0px) brightness(1)' },
    ],
    { duration: DURATION_MS / 2 },
  );

  // Each emoji spins individually
  const $$emojis = $circle.querySelectorAll('.emoji-item');
  $$emojis.forEach(($el) => {
    const baseRotate = parseFloat($el.style.rotate) || 0;
    const spinDeg = 720;
    const randDelay = (Math.random() * DURATION_MS) / 2;

    $el.animate(
      [
        { rotate: `${baseRotate}deg` },
        { rotate: `${baseRotate + spinDeg}deg` },
      ],
      { duration: DURATION_MS, easing: 'ease-out', delay: randDelay },
    );
  });
}
