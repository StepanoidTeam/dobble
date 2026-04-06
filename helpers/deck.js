import {
  getDeckStatsBySymbolsCount,
  totalCardsForOrder,
  symbolsPerCardForOrder,
} from './dobble-math.js';

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
// If symbolsPerCard is provided, use that instead of the maximum
export function buildDeck(symbols, symbolsPerCard) {
  const sourceSymbols = Array.isArray(symbols) ? symbols : [];
  const stats = getDeckStatsBySymbolsCount(sourceSymbols.length);

  console.log('🃏stats', stats);

  if (!stats) {
    return {
      deck: [],
      stats: null,
    };
  }

  // Convert symbolsPerCard to projective plane order n
  const n =
    symbolsPerCard && symbolsPerCard >= 3 && symbolsPerCard - 1 <= stats.n
      ? symbolsPerCard - 1
      : stats.n;
  const totalCards = totalCardsForOrder(n);

  const cards = generateDobbleCards(n);
  const safeSymbols = sourceSymbols.slice(0, totalCards);

  // Map indices to emojis
  const actualStats = {
    totalCards,
    symbolsPerCard: symbolsPerCardForOrder(n),
    totalSymbolsUsed: totalCards,
    unusedSymbols: sourceSymbols.length - totalCards,
    n,
    perfect: totalCards === sourceSymbols.length,
  };

  return {
    deck: cards.map((card) => card.map((idx) => safeSymbols[idx])),
    stats: actualStats,
  };
}

// Find the common symbol between two cards
export function findCommonSymbol(card1, card2) {
  for (const sym of card1) {
    if (card2.includes(sym)) return sym;
  }
  return null;
}
