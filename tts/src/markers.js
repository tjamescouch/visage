// Token marker (@@...@@) parser for TTS prosody control
// Parses @@marker@@ syntax from text and extracts prosody hints

/**
 * Marker types and their effects on speech
 */
const MARKER_EFFECTS = {
  // Emphasis - slower, slightly louder mouth movements
  emphasis: {
    speedMultiplier: 0.7,
    mouthScale: 1.3,
  },
  // Pause - insert silence
  pause: {
    pauseDuration: 0.4, // seconds
  },
  'long-pause': {
    pauseDuration: 0.8,
  },
  // Whisper - small mouth movements
  whisper: {
    speedMultiplier: 0.8,
    mouthScale: 0.4,
  },
  // Excitement - faster, bigger movements
  excited: {
    speedMultiplier: 1.3,
    mouthScale: 1.2,
    browRaise: 0.06,
  },
  // Question - brow raise at end
  question: {
    browRaise: 0.05,
  },
};

/**
 * Parse text containing @@marker@@ tokens.
 * Returns array of segments: either plain text or marker directives.
 *
 * Example:
 *   "Hello @@emphasis@@world@@/emphasis@@! @@pause@@"
 *   -> [{type:'text', content:'Hello '}, {type:'marker_start', name:'emphasis'},
 *       {type:'text', content:'world'}, {type:'marker_end', name:'emphasis'},
 *       {type:'text', content:'! '}, {type:'marker', name:'pause'}]
 */
export function parseMarkers(text) {
  const segments = [];
  const regex = /@@(\/?)(\w[\w-]*)@@/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before this marker
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    const isClosing = match[1] === '/';
    const name = match[2];

    if (isClosing) {
      segments.push({ type: 'marker_end', name });
    } else if (name === 'pause' || name === 'long-pause') {
      // Self-closing markers
      segments.push({ type: 'marker', name });
    } else {
      segments.push({ type: 'marker_start', name });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Get the effect parameters for a marker name.
 */
export function getMarkerEffect(name) {
  return MARKER_EFFECTS[name] || null;
}

/**
 * Strip all @@markers@@ from text, returning plain text.
 */
export function stripMarkers(text) {
  return text.replace(/@@\/?\w[\w-]*@@/g, '').replace(/\s+/g, ' ').trim();
}

export { MARKER_EFFECTS };
