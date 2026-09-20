/**
 * @file incrementalCache.js
 * @description In-memory cache for compiler products reused by watch/serve builds.
 *
 * The cache is deliberately process-local. `avenx build` never uses it, while
 * long-lived `avenx serve` / `avenx watch` sessions can reuse unchanged
 * component/page compilation products.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MAX_ENTRIES = 2000;

/** @type {Map<string, object>} */
const units = new Map();

/**
 * Hashes a string.
 * @param {string} value
 * @returns {string}
 */
function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

/**
 * Returns the current content of a file, or null when it does not exist.
 *
 * @param {string} filePath
 * @returns {string|null}
 */
export function readFileFingerprint(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Creates a deterministic compiler-session fingerprint.
 *
 * Include every project-wide input that can affect generated output.
 *
 * @param {object} options
 * @param {string} options.rootDir
 * @param {object} options.config
 * @param {string} options.compilerFingerprint
 * @returns {string}
 */
export function createSessionFingerprint({ rootDir, config, compilerFingerprint }) {
  const configPath = path.join(rootDir, 'avenx.config.json');
  const configSource = readFileFingerprint(configPath) || '';

  return hash(
    JSON.stringify({
      rootDir,
      config,
      configSource,
      compilerFingerprint,
    }),
  );
}

/**
 * Creates the key for one source unit.
 *
 * @param {object} options
 * @param {string} options.filePath
 * @param {'component'|'page'} options.kind
 * @param {string} options.source
 * @param {string|null} options.styleSource
 * @param {string} options.sessionFingerprint
 * @returns {string}
 */
export function createUnitKey({
  filePath,
  kind,
  source,
  styleSource,
  sessionFingerprint,
}) {
  return hash(
    JSON.stringify({
      filePath: path.resolve(filePath),
      kind,
      source,
      styleSource,
      sessionFingerprint,
    }),
  );
}

/**
 * Reads a cached unit and refreshes its LRU position.
 *
 * @param {string} key
 * @returns {object|null}
 */
export function getCachedUnit(key) {
  const hit = units.get(key);

  if (!hit) {
    return null;
  }

  units.delete(key);
  units.set(key, hit);
  return hit;
}

/**
 * Stores a compiled unit.
 *
 * @param {string} key
 * @param {object} value
 */
export function setCachedUnit(key, value) {
  if (units.has(key)) {
    units.delete(key);
  }

  while (units.size >= MAX_ENTRIES) {
    const oldest = units.keys().next().value;
    units.delete(oldest);
  }

  units.set(key, value);
}

/**
 * Clears all compiler products.
 */
export function clearIncrementalCache() {
  units.clear();
}

/**
 * Returns the number of cached units.
 *
 * @returns {number}
 */
export function incrementalCacheSize() {
  return units.size;
}

export default {
  createSessionFingerprint,
  createUnitKey,
  getCachedUnit,
  setCachedUnit,
  clearIncrementalCache,
  incrementalCacheSize,
};
