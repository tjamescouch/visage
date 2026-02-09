import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { extractFeatures } from './features.js';
import type { FeatureVector, PriceResult, FeatureBreakdown, Weights } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const weightsPath = join(__dirname, 'weights.json');
let weights: Weights;
try {
  weights = JSON.parse(readFileSync(weightsPath, 'utf-8'));
} catch {
  // Fallback weights
  weights = {
    layer1: { length: 3.0, word: 2.5, lucky: 2.0, meme: 1.8, repeat: 1.5, pronounce: 0.8, palindrome: 1.2, sequential: 0.6, digits: 0.5 },
    layer2: { shortWord: 2.0, digitLucky: 1.5, repeatLucky: 1.8, shortDigit: 1.2, memePalindrome: 1.0 },
    basePrice: 10,
    maxPrice: 5000,
    scale: 4.0,
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function priceHandle(handle: string): PriceResult {
  const features = extractFeatures(handle);
  const breakdown: FeatureBreakdown[] = [];

  // Layer 1: Direct feature weights
  const l1 = weights.layer1;
  const layer1Pairs: [string, number, number][] = [
    ['length', features.lengthScore, l1.length],
    ['word', features.isWord, l1.word],
    ['lucky', features.luckyScore, l1.lucky],
    ['meme', features.memeScore, l1.meme],
    ['repeat', features.repeatingScore, l1.repeat],
    ['pronounce', features.pronounceability, l1.pronounce],
    ['palindrome', features.isPalindrome, l1.palindrome],
    ['sequential', features.isSequential, l1.sequential],
    ['digits', features.allDigits, l1.digits],
  ];

  let score = 0;
  for (const [name, value, weight] of layer1Pairs) {
    const contribution = value * weight;
    score += contribution;
    if (contribution !== 0) {
      breakdown.push({ name, value, weight, contribution });
    }
  }

  // Layer 2: Interaction terms
  const l2 = weights.layer2;
  const isShort = features.lengthScore > 0.5; // 1-2 chars

  if (isShort && features.isWord > 0) {
    const c = l2.shortWord;
    score += c;
    breakdown.push({ name: 'short+word', value: 1, weight: c, contribution: c });
  }
  if (features.allDigits > 0 && features.luckyScore > 0) {
    const c = features.luckyScore * l2.digitLucky;
    score += c;
    breakdown.push({ name: 'digit+lucky', value: features.luckyScore, weight: l2.digitLucky, contribution: c });
  }
  if (features.repeatingScore > 0 && features.luckyScore > 0) {
    const c = features.repeatingScore * features.luckyScore * l2.repeatLucky;
    score += c;
    breakdown.push({ name: 'repeat+lucky', value: features.repeatingScore * features.luckyScore, weight: l2.repeatLucky, contribution: c });
  }
  if (isShort && features.allDigits > 0) {
    const c = features.lengthScore * l2.shortDigit;
    score += c;
    breakdown.push({ name: 'short+digit', value: features.lengthScore, weight: l2.shortDigit, contribution: c });
  }
  if (features.memeScore > 0 && features.isPalindrome > 0) {
    const c = l2.memePalindrome;
    score += c;
    breakdown.push({ name: 'meme+palindrome', value: 1, weight: c, contribution: c });
  }

  // Output: sigmoid scaling to price range
  const normalizedScore = sigmoid(score / weights.scale);
  const price = Math.round(weights.basePrice + (weights.maxPrice - weights.basePrice) * normalizedScore);

  return { handle, price, features, breakdown };
}

export function reloadWeights(): void {
  try {
    const raw = readFileSync(weightsPath, 'utf-8');
    weights = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to reload weights:', e);
  }
}
