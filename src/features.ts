import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureVector } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load word list once at startup
const wordsPath = join(__dirname, '..', 'data', 'words.txt');
let wordSet: Set<string>;
try {
  const raw = readFileSync(wordsPath, 'utf-8');
  wordSet = new Set(raw.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean));
} catch {
  wordSet = new Set();
}

// Meme numbers
const MEME_NUMBERS: Record<string, number> = {
  '69': 1.0,
  '420': 1.0,
  '1337': 0.8,
  '42': 0.9,
  '80085': 0.7,
  '666': 0.8,
  '911': 0.6,
  '007': 0.7,
  '404': 0.7,
  '101': 0.5,
  '360': 0.5,
  '99': 0.5,
  '100': 0.6,
  '000': 0.5,
};

// Chinese numerology scores
const LUCKY_DIGITS: Record<string, number> = {
  '8': 1.0,    // very lucky (prosperity)
  '6': 0.6,    // lucky (smooth)
  '9': 0.5,    // lucky (longevity)
  '2': 0.2,    // neutral-good (harmony)
  '7': 0.1,    // neutral
  '1': 0.1,    // neutral
  '3': 0.1,    // neutral
  '5': 0.0,    // neutral
  '0': 0.0,    // neutral
  '4': -0.8,   // very unlucky (death)
};

const VOWELS = new Set('aeiou');
const CONSONANTS = new Set('bcdfghjklmnpqrstvwxyz');

export function extractFeatures(handle: string): FeatureVector {
  const h = handle.toLowerCase();

  return {
    lengthScore: computeLengthScore(h),
    isWord: wordSet.has(h) ? 1.0 : 0.0,
    luckyScore: computeLuckyScore(h),
    memeScore: computeMemeScore(h),
    repeatingScore: computeRepeatingScore(h),
    pronounceability: computePronouncability(h),
    isPalindrome: isPalindrome(h) ? 1.0 : 0.0,
    isSequential: computeSequentialScore(h),
    allDigits: /^\d+$/.test(h) ? 1.0 : 0.0,
  };
}

function computeLengthScore(h: string): number {
  // 1 char = 1.0, exponential decay
  const len = h.length;
  if (len <= 0) return 0;
  return Math.exp(-0.5 * (len - 1));
}

function computeLuckyScore(h: string): number {
  if (!/^\d+$/.test(h)) return 0;
  const digits = h.split('');
  const total = digits.reduce((sum, d) => sum + (LUCKY_DIGITS[d] ?? 0), 0);
  return Math.max(-1, Math.min(1, total / digits.length));
}

function computeMemeScore(h: string): number {
  return MEME_NUMBERS[h] ?? 0;
}

function computeRepeatingScore(h: string): number {
  if (h.length < 2) return 0;
  const allSame = h.split('').every(c => c === h[0]);
  if (allSame) return 1.0;

  // Check for 2-char repeating pattern (e.g., "abab")
  if (h.length >= 4 && h.length % 2 === 0) {
    const pattern = h.slice(0, 2);
    const repeated = pattern.repeat(h.length / 2);
    if (repeated === h) return 0.6;
  }

  // Partial repeating: count max run
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < h.length; i++) {
    if (h[i] === h[i - 1]) {
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }
  if (maxRun >= h.length * 0.5) return 0.4;
  return 0;
}

function computePronouncability(h: string): number {
  if (!/^[a-z]+$/.test(h)) return 0;
  if (h.length < 2) return 0.5;

  // Count consonant-vowel transitions (good for pronounceability)
  let transitions = 0;
  for (let i = 1; i < h.length; i++) {
    const prev = VOWELS.has(h[i - 1]);
    const curr = VOWELS.has(h[i]);
    if (prev !== curr) transitions++;
  }

  return Math.min(1, transitions / (h.length - 1));
}

function isPalindrome(h: string): boolean {
  if (h.length < 2) return false;
  const reversed = h.split('').reverse().join('');
  return h === reversed;
}

function computeSequentialScore(h: string): number {
  if (h.length < 2) return 0;

  // Check ascending/descending numeric sequences
  if (/^\d+$/.test(h)) {
    let ascending = true;
    let descending = true;
    for (let i = 1; i < h.length; i++) {
      const diff = h.charCodeAt(i) - h.charCodeAt(i - 1);
      if (diff !== 1) ascending = false;
      if (diff !== -1) descending = false;
    }
    if (ascending || descending) return 1.0;
  }

  // Check ascending/descending alpha sequences
  if (/^[a-z]+$/.test(h)) {
    let ascending = true;
    let descending = true;
    for (let i = 1; i < h.length; i++) {
      const diff = h.charCodeAt(i) - h.charCodeAt(i - 1);
      if (diff !== 1) ascending = false;
      if (diff !== -1) descending = false;
    }
    if (ascending || descending) return 1.0;
  }

  return 0;
}
