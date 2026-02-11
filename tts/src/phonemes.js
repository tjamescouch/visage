// Phoneme-to-viseme mapping for lip-sync generation
// Maps English phonemes to mouth shape parameters (visemes)
//
// Viseme parameters map directly to MocapFrame points:
//   mouth_open  - vertical opening (0-1)
//   mouth_wide  - horizontal stretch (0-1)
//   jaw_open    - jaw displacement (0-1)

const VISEME_MAP = {
  // Silence
  '_':  { mouth_open: 0.0,  mouth_wide: 0.0, jaw_open: 0.0 },

  // Vowels
  'AA': { mouth_open: 0.85, mouth_wide: 0.3, jaw_open: 0.8 },  // father
  'AE': { mouth_open: 0.7,  mouth_wide: 0.5, jaw_open: 0.6 },  // cat
  'AH': { mouth_open: 0.6,  mouth_wide: 0.3, jaw_open: 0.5 },  // but
  'AO': { mouth_open: 0.7,  mouth_wide: 0.2, jaw_open: 0.7 },  // caught
  'AW': { mouth_open: 0.7,  mouth_wide: 0.2, jaw_open: 0.7 },  // cow
  'AY': { mouth_open: 0.7,  mouth_wide: 0.4, jaw_open: 0.6 },  // my
  'EH': { mouth_open: 0.5,  mouth_wide: 0.5, jaw_open: 0.4 },  // bed
  'ER': { mouth_open: 0.4,  mouth_wide: 0.2, jaw_open: 0.3 },  // bird
  'EY': { mouth_open: 0.4,  mouth_wide: 0.6, jaw_open: 0.3 },  // say
  'IH': { mouth_open: 0.3,  mouth_wide: 0.5, jaw_open: 0.2 },  // bit
  'IY': { mouth_open: 0.2,  mouth_wide: 0.7, jaw_open: 0.15 }, // beat
  'OW': { mouth_open: 0.6,  mouth_wide: 0.1, jaw_open: 0.5 },  // go
  'OY': { mouth_open: 0.6,  mouth_wide: 0.2, jaw_open: 0.5 },  // boy
  'UH': { mouth_open: 0.4,  mouth_wide: 0.15, jaw_open: 0.35 },// book
  'UW': { mouth_open: 0.3,  mouth_wide: 0.1, jaw_open: 0.3 },  // boot

  // Consonants
  'B':  { mouth_open: 0.0,  mouth_wide: 0.0, jaw_open: 0.05 }, // bilabial stop
  'CH': { mouth_open: 0.15, mouth_wide: 0.3, jaw_open: 0.1 },  // church
  'D':  { mouth_open: 0.1,  mouth_wide: 0.3, jaw_open: 0.1 },  // alveolar stop
  'DH': { mouth_open: 0.1,  mouth_wide: 0.3, jaw_open: 0.1 },  // the
  'F':  { mouth_open: 0.05, mouth_wide: 0.3, jaw_open: 0.05 }, // labiodental
  'G':  { mouth_open: 0.15, mouth_wide: 0.2, jaw_open: 0.15 }, // velar stop
  'HH': { mouth_open: 0.3,  mouth_wide: 0.3, jaw_open: 0.2 },  // he
  'JH': { mouth_open: 0.15, mouth_wide: 0.3, jaw_open: 0.1 },  // judge
  'K':  { mouth_open: 0.15, mouth_wide: 0.2, jaw_open: 0.15 }, // velar stop
  'L':  { mouth_open: 0.2,  mouth_wide: 0.3, jaw_open: 0.15 }, // lateral
  'M':  { mouth_open: 0.0,  mouth_wide: 0.0, jaw_open: 0.05 }, // bilabial nasal
  'N':  { mouth_open: 0.1,  mouth_wide: 0.3, jaw_open: 0.1 },  // alveolar nasal
  'NG': { mouth_open: 0.15, mouth_wide: 0.2, jaw_open: 0.15 }, // velar nasal
  'P':  { mouth_open: 0.0,  mouth_wide: 0.0, jaw_open: 0.05 }, // bilabial stop
  'R':  { mouth_open: 0.2,  mouth_wide: 0.15, jaw_open: 0.15 },// retroflex
  'S':  { mouth_open: 0.05, mouth_wide: 0.4, jaw_open: 0.05 }, // alveolar fricative
  'SH': { mouth_open: 0.1,  mouth_wide: 0.2, jaw_open: 0.08 }, // postalveolar
  'T':  { mouth_open: 0.1,  mouth_wide: 0.3, jaw_open: 0.1 },  // alveolar stop
  'TH': { mouth_open: 0.1,  mouth_wide: 0.3, jaw_open: 0.08 }, // dental fricative
  'V':  { mouth_open: 0.05, mouth_wide: 0.3, jaw_open: 0.05 }, // labiodental
  'W':  { mouth_open: 0.2,  mouth_wide: 0.05, jaw_open: 0.15 },// labial-velar
  'Y':  { mouth_open: 0.15, mouth_wide: 0.5, jaw_open: 0.1 },  // palatal
  'Z':  { mouth_open: 0.05, mouth_wide: 0.4, jaw_open: 0.05 }, // alveolar fricative
  'ZH': { mouth_open: 0.1,  mouth_wide: 0.2, jaw_open: 0.08 }, // postalveolar
};

// Simple English text to approximate phoneme sequence
// This is a rough heuristic — real TTS would use a proper G2P model
const LETTER_TO_PHONEME = {
  'a': 'AH', 'b': 'B', 'c': 'K', 'd': 'D', 'e': 'EH',
  'f': 'F', 'g': 'G', 'h': 'HH', 'i': 'IH', 'j': 'JH',
  'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'OW',
  'p': 'P', 'q': 'K', 'r': 'R', 's': 'S', 't': 'T',
  'u': 'AH', 'v': 'V', 'w': 'W', 'x': 'K', 'y': 'IY',
  'z': 'Z',
};

// Common digraphs
const DIGRAPHS = {
  'th': 'TH', 'sh': 'SH', 'ch': 'CH', 'wh': 'W',
  'ph': 'F', 'ng': 'NG', 'oo': 'UW', 'ee': 'IY',
  'ea': 'IY', 'ou': 'AW', 'ow': 'AW', 'ai': 'EY',
  'ay': 'EY', 'oi': 'OY', 'oy': 'OY', 'ar': 'AA',
  'er': 'ER', 'ir': 'ER', 'or': 'AO', 'ur': 'ER',
};

/**
 * Convert text to an approximate phoneme sequence.
 * Each phoneme has a duration estimate in seconds.
 * Returns [{phoneme, duration}]
 */
export function textToPhonemes(text) {
  const result = [];
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, '');
  const words = lower.split(/\s+/).filter(w => w.length > 0);

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    let i = 0;
    while (i < word.length) {
      // Check digraphs first
      if (i + 1 < word.length) {
        const di = word.slice(i, i + 2);
        if (DIGRAPHS[di]) {
          const isVowel = 'AEIOU'.includes(DIGRAPHS[di][0]);
          result.push({
            phoneme: DIGRAPHS[di],
            duration: isVowel ? 0.1 : 0.07,
          });
          i += 2;
          continue;
        }
      }
      // Single letter
      const ch = word[i];
      const ph = LETTER_TO_PHONEME[ch] || '_';
      const isVowel = 'AEIOU'.includes(ph[0]);
      result.push({
        phoneme: ph,
        duration: isVowel ? 0.09 : 0.06,
      });
      i++;
    }
    // Inter-word pause
    if (wi < words.length - 1) {
      result.push({ phoneme: '_', duration: 0.08 });
    }
  }

  return result;
}

/**
 * Get the viseme (mouth shape) for a phoneme.
 */
export function phonemeToViseme(phoneme) {
  return VISEME_MAP[phoneme] || VISEME_MAP['_'];
}

/**
 * Convert phoneme sequence to timed MocapFrame point arrays.
 * Returns [{t, pts: {mouth_open, mouth_wide, jaw_open, mouth_smile}}]
 * at the specified FPS.
 */
export function phonemesToFrames(phonemes, fps = 30) {
  const frameDuration = 1.0 / fps;
  const frames = [];
  let currentTime = 0;

  // Calculate total duration
  const totalDuration = phonemes.reduce((sum, p) => sum + p.duration, 0);

  // Build a timeline of viseme targets
  const timeline = [];
  let t = 0;
  for (const p of phonemes) {
    timeline.push({
      start: t,
      end: t + p.duration,
      viseme: phonemeToViseme(p.phoneme),
    });
    t += p.duration;
  }

  // Sample at FPS rate with interpolation
  while (currentTime < totalDuration) {
    // Find current and next viseme
    let current = timeline.find(e => currentTime >= e.start && currentTime < e.end);
    if (!current) current = timeline[timeline.length - 1];

    const progress = (currentTime - current.start) / (current.end - current.start);
    const v = current.viseme;

    // Find next segment for interpolation
    const nextIdx = timeline.indexOf(current) + 1;
    const next = nextIdx < timeline.length ? timeline[nextIdx].viseme : VISEME_MAP['_'];

    // Smooth interpolation toward next viseme near segment boundaries
    const blend = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;

    const lerp = (a, b, t) => a + (b - a) * t;

    frames.push({
      t: currentTime,
      pts: {
        mouth_open: lerp(v.mouth_open, next.mouth_open, blend),
        mouth_wide: lerp(v.mouth_wide, next.mouth_wide, blend),
        jaw_open: lerp(v.jaw_open, next.jaw_open, blend),
        mouth_smile: 0.05, // subtle neutral smile while speaking
      },
    });

    currentTime += frameDuration;
  }

  // End with mouth closed
  frames.push({
    t: currentTime,
    pts: { mouth_open: 0, mouth_wide: 0, jaw_open: 0, mouth_smile: 0.1 },
  });

  return frames;
}

export { VISEME_MAP };
