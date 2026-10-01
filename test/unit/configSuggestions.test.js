import assert from 'node:assert';
import { levenshtein, getClosestKey } from '../../lib/config.js';
import { KNOWN_COMMANDS } from '../../bin/cli.js';

console.log('Running config suggestions & Levenshtein unit tests...');

// ========================================================
// 1. levenshtein tests
// ========================================================

// Identical strings have distance 0
assert.strictEqual(levenshtein('build', 'build'), 0, 'Distance between identical strings must be 0');
assert.strictEqual(levenshtein('', ''), 0, 'Distance between empty strings must be 0');

// Empty string against non-empty string equals string length
assert.strictEqual(levenshtein('', 'serve'), 5, 'Empty vs non-empty returns target string length');
assert.strictEqual(levenshtein('serve', ''), 5, 'Non-empty vs empty returns source string length');

// Single character operations (insertion, deletion, substitution)
assert.strictEqual(levenshtein('cat', 'cats'), 1, 'Single insertion must have distance 1');
assert.strictEqual(levenshtein('cats', 'cat'), 1, 'Single deletion must have distance 1');
assert.strictEqual(levenshtein('cat', 'bat'), 1, 'Single substitution must have distance 1');

// Transposition (Levenshtein standard counts transposition as 1 delete + 1 insert = 2)
assert.strictEqual(levenshtein('ab', 'ba'), 2, 'Transposition of adjacent characters has distance 2');

// Symmetry: f(a, b) === f(b, a)
assert.strictEqual(
  levenshtein('kitten', 'sitting'),
  levenshtein('sitting', 'kitten'),
  'Levenshtein must be symmetric'
);
assert.strictEqual(levenshtein('kitten', 'sitting'), 3, 'kitten -> sitting distance must be 3');


// ========================================================
// 2. getClosestKey tests
// ========================================================

// Exact match returns itself
assert.strictEqual(
  getClosestKey('build', ['build', 'serve', 'test']),
  'build',
  'Exact match must return itself'
);

// Empty candidate list returns null
assert.strictEqual(
  getClosestKey('build', []),
  null,
  'Empty candidates list must return null'
);

// Distance threshold boundary: distance <= 3 matches, distance 4 does not
const baseWord = 'development';
// Substitution of 3 letters (distance = 3) -> should match
assert.strictEqual(
  getClosestKey('xxxelopment', [baseWord]),
  baseWord,
  'Distance of exactly 3 must match (threshold is <= 3)'
);
// Substitution of 4 letters (distance = 4) -> should not match
assert.strictEqual(
  getClosestKey('xxxxlopment', [baseWord]),
  null,
  'Distance of 4 must return null'
);

// Case-insensitivity (both input and candidate casing)
assert.strictEqual(
  getClosestKey('BUILD', ['build', 'serve']),
  'build',
  'Must match when input is uppercase'
);
assert.strictEqual(
  getClosestKey('serve', ['SERVE', 'BUILD']),
  'SERVE',
  'Must match when target list contains uppercase'
);

// Tie-breaking: returns first candidate in list order (< rather than <=)
assert.strictEqual(
  getClosestKey('cat', ['bat', 'car', 'can']),
  'bat',
  'On tie distance, the first candidate in array order must be returned'
);

// Real candidate list test: KNOWN_COMMANDS
assert.ok(Array.isArray(KNOWN_COMMANDS) && KNOWN_COMMANDS.length > 0, 'KNOWN_COMMANDS must be a populated array');

// Pick an item with length > 3 from KNOWN_COMMANDS to produce a 1-character typo
const realCommand = KNOWN_COMMANDS.find((cmd) => cmd.length > 3) || KNOWN_COMMANDS[0];
const typo = realCommand.slice(0, -1); // 1 deletion

assert.strictEqual(
  getClosestKey(typo, KNOWN_COMMANDS),
  realCommand,
  `Typo "${typo}" should resolve to "${realCommand}" in KNOWN_COMMANDS`
);

console.log('✔ All config suggestions and Levenshtein unit tests passed.');