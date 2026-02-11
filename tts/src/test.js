// Quick tests for TTS service modules
import { textToPhonemes, phonemeToViseme, phonemesToFrames } from './phonemes.js';
import { generateLipSync } from './lipsync.js';
import { parseMarkers, stripMarkers, getMarkerEffect } from './markers.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

console.log('--- phonemes.js ---');

const ph = textToPhonemes('hello');
assert(ph.length > 0, 'should produce phonemes for "hello"');
console.log(`  "hello" -> ${ph.map(p => p.phoneme).join(' ')} (${ph.length} phonemes)`);

const ph2 = textToPhonemes('the quick brown fox');
assert(ph2.length > 0, 'should produce phonemes for sentence');
assert(ph2.some(p => p.phoneme === '_'), 'should have pauses between words');
console.log(`  "the quick brown fox" -> ${ph2.length} phonemes`);

const v = phonemeToViseme('AA');
assert(v.mouth_open > 0.5, 'AA should have wide mouth');
assert(v.jaw_open > 0.5, 'AA should have open jaw');

const v2 = phonemeToViseme('M');
assert(v2.mouth_open === 0, 'M should have closed mouth');

console.log('\n--- markers.js ---');

const segs = parseMarkers('Hello @@emphasis@@world@@/emphasis@@! @@pause@@');
// Segments: "Hello " | marker_start emphasis | "world" | marker_end emphasis | "! " | marker pause
assert(segs.length === 6, `should have 6 segments, got ${segs.length}`);
assert(segs[0].type === 'text', 'first segment is text');
assert(segs[0].content === 'Hello ', 'first segment content');
assert(segs[1].type === 'marker_start', 'second is marker_start');
assert(segs[1].name === 'emphasis', 'emphasis marker');
assert(segs[2].type === 'text', 'third is text');
assert(segs[2].content === 'world', 'world content');
assert(segs[3].type === 'marker_end', 'fourth is marker_end');
assert(segs[4].type === 'text', 'fifth is text (punctuation)');
assert(segs[5].type === 'marker', 'sixth is self-closing marker');
assert(segs[5].name === 'pause', 'pause marker');
console.log(`  parsed 6 segments correctly`);

const stripped = stripMarkers('Hello @@emphasis@@world@@/emphasis@@!');
assert(stripped === 'Hello world!', `strip should give "Hello world!", got "${stripped}"`);
console.log(`  stripMarkers works`);

const eff = getMarkerEffect('emphasis');
assert(eff !== null, 'emphasis effect exists');
assert(eff.speedMultiplier < 1, 'emphasis slows down');
assert(eff.mouthScale > 1, 'emphasis enlarges mouth');
console.log(`  emphasis effect: speed=${eff.speedMultiplier}, scale=${eff.mouthScale}`);

const pauseEff = getMarkerEffect('pause');
assert(pauseEff.pauseDuration > 0, 'pause has duration');
console.log(`  pause effect: ${pauseEff.pauseDuration}s`);

console.log('\n--- lipsync.js ---');

const result = generateLipSync('hello world');
assert(result.frames.length > 0, 'should generate frames');
assert(result.duration > 0, 'should have positive duration');
assert(result.phonemeCount > 0, 'should count phonemes');
console.log(`  "hello world" -> ${result.frames.length} frames, ${result.duration.toFixed(2)}s`);

// Check frames are properly timed
const times = result.frames.map(f => f.t);
for (let i = 1; i < times.length; i++) {
  assert(times[i] >= times[i-1], `frame ${i} should be after frame ${i-1}`);
}

// Check all frames have required points
for (const f of result.frames) {
  assert('mouth_open' in f.pts, 'frame should have mouth_open');
  assert('mouth_wide' in f.pts, 'frame should have mouth_wide');
  assert('jaw_open' in f.pts, 'frame should have jaw_open');
  assert(f.pts.mouth_open >= 0 && f.pts.mouth_open <= 1, 'mouth_open in range');
  assert(f.pts.jaw_open >= 0 && f.pts.jaw_open <= 1, 'jaw_open in range');
}

// Speed test
const fast = generateLipSync('hello world', { speed: 2.0 });
assert(fast.duration < result.duration, 'faster speed should be shorter');
console.log(`  speed 2x: ${fast.duration.toFixed(2)}s (vs ${result.duration.toFixed(2)}s normal)`);

// @@marker@@ tests
console.log('\n--- lipsync.js with @@markers@@ ---');

const markerResult = generateLipSync('Hello @@emphasis@@world@@/emphasis@@!');
assert(markerResult.frames.length > 0, 'marker text should produce frames');
console.log(`  with emphasis: ${markerResult.frames.length} frames, ${markerResult.duration.toFixed(2)}s`);

const pauseResult = generateLipSync('Hello @@pause@@ world');
assert(pauseResult.duration > result.duration * 0.5, 'pause should add duration');
console.log(`  with pause: ${pauseResult.frames.length} frames, ${pauseResult.duration.toFixed(2)}s`);

const excitedResult = generateLipSync('@@excited@@Wow this is amazing@@/excited@@');
assert(excitedResult.frames.length > 0, 'excited text should produce frames');
// Excited has brow raise
const hasBrow = excitedResult.frames.some(f => f.pts.left_brow_height > 0);
assert(hasBrow, 'excited should raise brows');
console.log(`  with excited: ${excitedResult.frames.length} frames, brow raise=${hasBrow}`);

// Longer text
const long = generateLipSync('The quick brown fox jumps over the lazy dog.');
console.log(`  long text -> ${long.frames.length} frames, ${long.duration.toFixed(2)}s`);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
