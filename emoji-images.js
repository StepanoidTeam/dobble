// ===== Custom Emoji Image Map =====
// Maps emoji character → PNG path (relative to root).
// Drop PNGs into images/emojis/ and add an entry here.
// Emojis without an entry fall back to native OS rendering.

// todo(vmyshko): we can just name images using emojis, and do not rely on mappings at all
const CUSTOM_EMOJI_IMAGES = new Map([
  // emojis-origin.js — green
  ['🦖', './images/emojis/dino.png'],
  ['🐢', './images/emojis/turtle.png'],
  ['🥕', './images/emojis/carrot.png'],
  ['🌳', './images/emojis/tree.png'],
  ['🌵', './images/emojis/cactus.png'],
  ['🍀', './images/emojis/clover.png'],
  ['🍏', './images/emojis/apple.png'],
  ['❓', './images/emojis/question-green.png'],
  ['🦠', './images/emojis/splatter2.png'], // клякса
  ['🫟', './images/emojis/splatter.png'], // клякса

  // emojis-origin.js — violet
  ['🐉', './images/emojis/dragon.png'],
  ['✂️', './images/emojis/scissors-violet.png'],
  ['🐦', './images/emojis/bird.png'],
  // ['🐦', './images/emojis/bird2.png'], // альтернатива
  ['🕸️', './images/emojis/web.png'],
  ['👁️', './images/emojis/eye.png'],
  // ['👁️', './images/emojis/pyramid-eye.png'],  // альтернатива (глаз в пирамиде)
  // ['👁️', './images/emojis/hand-eye.png'],     // альтернатива (глаз на ладони)
  ['✋', './images/emojis/hand-green.png'],
  // ['✋', './images/emojis/hand-eye.png'],     // альтернатива (глаз на ладони)
  ['🕯️', './images/emojis/candle.png'],
  ['🐱', './images/emojis/cat.png'], // кот

  // emojis-origin.js — orange
  ['🚕', './images/emojis/taxi.png'],
  ['🔨', './images/emojis/hammer.png'],
  ['🍼', './images/emojis/milkbottle.png'],
  ['⚓️', './images/emojis/anchor.png'],
  ['🍪', './images/emojis/cookie.png'],
  ['⏰', './images/emojis/clock.png'],
  ['🔑', './images/emojis/key.png'],
  ['🏆', './images/emojis/trophy.png'],
  ['🎼', './images/emojis/musical-score.png'], // скрипичный ключ?

  // emojis-origin.js — blue
  ['🧊', './images/emojis/ice-cube.png'],
  ['🏠', './images/emojis/ice-home.png'], // ледяной дом — тот же файл, конфликт с 🧊
  ['👻', './images/emojis/ghost.png'],
  ['⛄', './images/emojis/snowman.png'],
  ['💧', './images/emojis/waterdrop.png'],
  ['✏️', './images/emojis/pencil.png'], // карандаш
  ['❄️', './images/emojis/snowflake.png'], // снежинка
  ['🐬', './images/emojis/dolphin.png'],

  // emojis-origin.js — red
  ['🎯', './images/emojis/target.png'],
  ['❤️', './images/emojis/heart.png'],
  ['🍁', './images/emojis/mapleleaf.png'],
  ['💋', './images/emojis/lips.png'],
  // ['💋', './images/emojis/lips2.png'],     // альтернатива
  ['🛑', './images/emojis/stop.png'],
  ['❓', './images/emojis/question-red.png'], // красный знак вопроса
  ['🤡', './images/emojis/clown.png'], // клоун
  ['🐞', './images/emojis/ladybug.png'], // божья коровка
  ['🔥', './images/emojis/fire.png'], // огонь

  // emojis-origin.js — yellow
  ['🐶', './images/emojis/puppy.png'],
  ['💡', './images/emojis/lightbulb.png'],
  // ['💡', './images/emojis/lightbulb2.png'],// альтернатива
  ['☀️', './images/emojis/sun.png'], // солнце
  ['⚡️', './images/emojis/bolt.png'], // молния
  ['🌙', './images/emojis/moon.png'], // луна
  ['⚠️', './images/emojis/warning.png'], // предупреждение
  ['🧀', './images/emojis/cheese.png'], // сыр
  ['🌼', './images/emojis/flower.png'], // ромашка

  // emojis-origin.js — black
  ['🦓', './images/emojis/zebra.png'], // зебра
  ['🔒', './images/emojis/padlock.png'], // замок
  ['☯️', './images/emojis/yinyang.png'], // инь-янь
  ['🕷️', './images/emojis/spider.png'], // паук
  ['☠️', './images/emojis/skull.png'], // череп
  ['♟️', './images/emojis/chess.png'], // шахматная фигура
  ['🕶️', './images/emojis/facesunglasses.png'], // очки — нет файла
  ['💣', './images/emojis/bomb.png'], // бомба

  // emojis-claude.js
  ['🍕', './images/emojis/pizza.png'],
  ['🚀', './images/emojis/rocket.png'],
  ['🍉', './images/emojis/watermelon.png'],
  ['✂️', './images/emojis/scissors-red.png'],
]);

export function getEmojiImageUrl(emoji) {
  return CUSTOM_EMOJI_IMAGES.get(emoji) ?? null;
}
