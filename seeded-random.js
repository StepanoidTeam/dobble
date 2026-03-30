// ===== Seeded PRNG & Random Helpers =====

// Mulberry32 — fast 32-bit seeded PRNG
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic seed from a string
export function stringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Deterministic seed from card symbols
export function cardToSeed(card) {
  return stringToSeed(card.join('|'));
}

export class SeededRandom {
  random;
  _seed;

  constructor(seed) {
    this._seed = seed;
    this.random = mulberry32(seed);
  }

  sample(arr) {
    return arr[Math.floor(this.random() * arr.length)];
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  fromRange(min, max) {
    return Math.floor(min + this.random() * (max - min + 1));
  }
}

// Unseeded instance for non-deterministic usage
export const Random = new SeededRandom(Date.now());
