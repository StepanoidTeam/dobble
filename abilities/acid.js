// ===== Acid Ability =====

export const DURATION_MS = 6000;
export const COOLDOWN_MS = 8000;
export const ICON = '🫟';
export const KEY = 'acid';

export function animate($circle) {
  // Hue-rotate + saturate cycling on the whole card
  $circle.animate(
    [
      { filter: 'hue-rotate(0deg) saturate(1.5)' },
      { filter: 'hue-rotate(360deg) saturate(1.5)' },
    ],
    {
      duration: 800,
      iterations: Math.ceil(DURATION_MS / 800),
      easing: 'linear',
    },
  );

  // Card breathing + skew distortion
  $circle.animate(
    [
      { transform: 'scale(1) skew(0deg)', easing: 'ease-in-out' },
      { transform: 'scale(1.03) skew(-1.5deg)', easing: 'ease-in-out' },
      { transform: 'scale(0.97) skew(1.5deg)', easing: 'ease-in-out' },
      { transform: 'scale(1.02) skew(-1deg)', easing: 'ease-in-out' },
      { transform: 'scale(1) skew(0deg)' },
    ],
    { duration: 2000, iterations: Math.ceil(DURATION_MS / 2000) },
  );

  // Individual emojis wobble + brightness pulse with random delays
  const $$emojis = $circle.querySelectorAll('.emoji-item');
  $$emojis.forEach(($el) => {
    const delay = Math.random() * 2000;

    $el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', easing: 'ease-in-out' },
        {
          transform: 'translate(3px, -2px) rotate(5deg)',
          easing: 'ease-in-out',
        },
        {
          transform: 'translate(-2px, 3px) rotate(-3deg)',
          easing: 'ease-in-out',
        },
        {
          transform: 'translate(2px, 1px) rotate(4deg)',
          easing: 'ease-in-out',
        },
        { transform: 'translate(0, 0) rotate(0deg)' },
      ],
      { duration: 1200, iterations: Math.ceil(DURATION_MS / 1200), delay },
    );

    $el.animate(
      [
        { filter: 'brightness(1)', easing: 'ease-in-out' },
        { filter: 'brightness(1.4)', easing: 'ease-in-out' },
        { filter: 'brightness(1)' },
      ],
      { duration: 600, iterations: Math.ceil(DURATION_MS / 600), delay },
    );
  });
}
