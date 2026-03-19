import { getDeckStatsBySymbolsCount } from './dobble-math.js';

// ===== Dobble Card Generation =====
// Dobble uses a projective plane of order n.
// For valid n: total symbols/cards = n^2 + n + 1, symbols/card = n + 1.
// n is derived from the active emoji set size.

function generateDobbleCards(order) {
  const n = order;
  const cards = [];

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

  return cards;
}

// Build deck with actual emoji symbols
export function buildDeck(symbols) {
  const sourceSymbols = Array.isArray(symbols) ? symbols : [];
  const stats = getDeckStatsBySymbolsCount(sourceSymbols.length);

  console.log('🃏stats', stats);

  if (!stats) {
    return {
      deck: [],
      stats: null,
    };
  }

  const cards = generateDobbleCards(stats.n);
  const safeSymbols = sourceSymbols.slice(0, stats.totalSymbolsUsed);

  // Map indices to emojis
  return {
    deck: cards.map((card) => card.map((idx) => safeSymbols[idx])),
    stats,
  };
}

// Pick a random element from arr
export function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fisher-Yates shuffle
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Find the common symbol between two cards
export function findCommonSymbol(card1, card2) {
  for (const sym of card1) {
    if (card2.includes(sym)) return sym;
  }
  return null;
}
