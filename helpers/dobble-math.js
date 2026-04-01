export function getDeckStatsBySymbolsCount(symbolsCount) {
  if (!Number.isFinite(symbolsCount) || symbolsCount < 3) return null;

  // For Dobble: S = n^2 + n + 1, cards = S, symbols/card = n + 1
  const discriminant = 4 * symbolsCount - 3;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  const nFloat = (-1 + sqrtD) / 2;
  const n = Math.floor(nFloat);
  if (n < 1) return null;

  const totalCards = n * n + n + 1;
  const totalSymbolsUsed = totalCards;
  const unusedSymbols = symbolsCount - totalSymbolsUsed;

  return {
    totalCards,
    symbolsPerCard: n + 1,
    totalSymbolsUsed,
    unusedSymbols,
    n,
    perfect: totalCards === symbolsCount,
  };
}
