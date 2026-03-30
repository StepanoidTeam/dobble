// ===== Custom Emoji Images =====
// Images are stored in images/emojis/{setKey}/ and named after their emoji character.
// Emojis without a matching file fall back to native OS rendering.

export function getEmojiImageUrl(emoji, setKey) {
  if (!setKey) return null;
  return `./images/emojis/${setKey}/${encodeURIComponent(emoji)}.png`;
}
