// ===== Projective Plane Helpers =====
// Dobble uses a projective plane of order n.
// symbols per card = n + 1, total cards = total symbols = n² + n + 1.
export function totalCardsForOrder(n) {
  return n * n + n + 1;
}

export function symbolsPerCardForOrder(n) {
  return n + 1;
}

// Get all valid projective plane orders for a given symbol count
export function getValidOrders(totalSymbols) {
  const orders = [];
  for (let n = 2; n <= 20; n++) {
    const needed = totalCardsForOrder(n);
    if (needed <= totalSymbols) {
      orders.push({
        n,
        symbolsPerCard: symbolsPerCardForOrder(n),
        totalCards: needed,
        totalSymbols: needed,
      });
    }
  }
  return orders;
}

export function getDeckStatsBySymbolsCount(symbolsCount) {
  if (!Number.isFinite(symbolsCount) || symbolsCount < 3) return null;

  // For Dobble: S = n^2 + n + 1, cards = S, symbols/card = n + 1
  const discriminant = 4 * symbolsCount - 3;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  const nFloat = (-1 + sqrtD) / 2;
  const n = Math.floor(nFloat);
  if (n < 1) return null;

  const totalCards = totalCardsForOrder(n);
  const totalSymbolsUsed = totalCards;
  const unusedSymbols = symbolsCount - totalSymbolsUsed;

  return {
    totalCards,
    symbolsPerCard: symbolsPerCardForOrder(n),
    totalSymbolsUsed,
    unusedSymbols,
    n,
    perfect: totalCards === symbolsCount,
  };
}
