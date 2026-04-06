// ===== Freeze Ability =====

export const DURATION_MS = 15000;
export const COOLDOWN_MS = 10000;
export const ICON = '❄️';
export const KEY = 'freeze';
export const LOCKS_INPUT = true;

export function animate($circle) {
  // Frost overlay — icy blue tint + desaturation
  $circle.animate(
    [
      { filter: 'brightness(1) saturate(1) sepia(0) hue-rotate(0deg)' },
      {
        filter: 'brightness(1.15) saturate(0.3) sepia(0.4) hue-rotate(170deg)',
        offset: 0.1,
      },
      {
        filter: 'brightness(1.15) saturate(0.3) sepia(0.4) hue-rotate(170deg)',
        offset: 0.85,
      },
      { filter: 'brightness(1) saturate(1) sepia(0) hue-rotate(0deg)' },
    ],
    { duration: DURATION_MS, easing: 'ease-out' },
  );

  // Card freezes in place — subtle shrink + rigidity
  $circle.animate(
    [
      { transform: 'scale(1)', easing: 'cubic-bezier(0.2, 0, 0.8, 1)' },
      { transform: 'scale(0.96)', offset: 0.1 },
      { transform: 'scale(0.96)', offset: 0.85 },
      { transform: 'scale(1)' },
    ],
    { duration: DURATION_MS },
  );

  // Emojis — frost shimmer + slight random drift then freeze
  const $$emojis = $circle.querySelectorAll('.emoji-item');
  $$emojis.forEach(($el) => {
    const delay = Math.random() * 200;

    // Quick shake then lock
    $el.animate(
      [
        { transform: 'translate(0, 0)', easing: 'ease-out' },
        {
          transform: `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 4}px)`,
          offset: 0.05,
        },
        {
          transform: `translate(${(Math.random() - 0.5) * 2}px, ${(Math.random() - 0.5) * 2}px)`,
          offset: 0.1,
        },
        { transform: 'translate(0, 0)', offset: 0.15 },
        { transform: 'translate(0, 0)' },
      ],
      { duration: DURATION_MS, delay },
    );

    // Frost opacity pulse
    $el.animate(
      [
        { opacity: 1 },
        { opacity: 0.5, offset: 0.12 },
        { opacity: 0.6, offset: 0.85 },
        { opacity: 1 },
      ],
      { duration: DURATION_MS, delay },
    );
  });
}
