/**
 * @file incrementalCache.js
 * @description Reusing a unit's whole compilation product across rebuilds.
 *
 * `avenx serve` and `avenx watch` rebuild the entire project on every save, and
 * a project's components mostly do not change between two saves. This cache
 * keeps what {@link ComponentParser#parse} produced for each unit so an
 * unchanged file is replayed rather than recompiled.
 *
 * ## Why a return value is not enough
 *
 * `parse()` returns a class body, but that is only half of what it produces.
 * The rest it records on the parser: the unit's module metadata, its trace
 * locations, the component tags its template references, its Atlas fragment
 * input, and any render or expression gap the build has to report. A cache that
 * returned the string and skipped the recording would hand the next build a
 * bundle whose entry module cannot be framed and a trace sidecar and Atlas with
 * holes in them -- quietly, and only for the files that happened to hit.
 *
 * So a hit replays every one of those channels. {@link captureUnit} and
 * {@link replayUnit} are written as a pair against one list of channels for
 * exactly that reason: a channel added to `parse()` and forgotten here is the
 * failure this file is most likely to have, and keeping the two halves adjacent
 * is what makes the omission visible.
 *
 * ## What the key has to cover
 *
 * A unit's own text is not enough.
 *
 * Its stylesheet is a separate file, so `counter.component.css` changing has to
 * invalidate `counter.component.js`. Its bridge bindings resolve against a
 * bridge's own declared surface, so renaming a getter must invalidate every
 * consumer even though no consumer's file changed. Its unresolved-component
 * check (AVX_W46) resolves template tags against every component name in the
 * project, so adding the component that a typo was reaching for must invalidate
 * the file holding the typo. And the emitted output differs between a
 * development and a production build, so the mode belongs in the key too.
 *
 * Those cross-unit inputs are folded into one environment fingerprint rather
 * than tracked per edge. It is coarse -- adding any component invalidates every
 * unit -- and that is the intended trade: the common case this exists for is
 * editing a file that is already there, which leaves the fingerprint untouched,
 * while add, rename and delete fall back to a cold build instead of to a
 * dependency analysis that could be wrong. A stale unit is worse than no cache,
 * because it would put code in the bundle that the sources no longer describe.
 *
 * The cache lives in memory for the life of the process, on the same terms as
 * `atlas/cache.js`: a disk cache would add invalidation risk across process
 * boundaries, and `avenx build` does not use this at all, so no production
 * artifact can depend on cache state.
 * @module lib/compiler/incrementalCache
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * How many unit products to retain.
 *
 * Matches `atlas/cache.js`: large enough for a substantial application, bounded
 * so a long-lived dev server cannot grow without limit.
 * @type {number}
 */
const MAX_ENTRIES = 2000;

/** @type {Map<string, object>} */
const store = new Map();

/** @type {string|null} */
let compilerFingerprintCache = null;

/**
 * Hit and miss counts since the last reset.
 *
 * Kept because "the cache is safe" and "the cache is doing anything" are
 * different claims, and a test that only checks the first passes just as well
 * against a cache that never hits.
 * @type {{hits: number, misses: number}}
 */
const stats = { hits: 0, misses: 0 };

/**
 * Serialises a value so that equal inputs always produce equal text.
 *
 * `JSON.stringify` preserves insertion order, which differs between a config
 * read from disk and the same config merged with compiler options, and it drops
 * `Set` and `Map` contents entirely -- both of which appear in what this file
 * digests. Sorting keys and normalising collections makes the digest depend on
 * the value rather than on how it was assembled.
 * @param {*} value - The value to serialise.
 * @returns {string} A canonical form.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (value instanceof Set) {
    return `Set(${[...value].map((entry) => stableStringify(entry)).sort().join(',')})`;
  }
  if (value instanceof Map) {
    return `Map(${[...value.entries()]
      .map(([key, entry]) => `${stableStringify(key)}:${stableStringify(entry)}`)
      .sort()
      .join(',')})`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

/**
 * Hashes the parts of a key into one digest.
 * @param {...*} parts - Values to include, in a fixed order.
 * @returns {string} The digest.
 */
function digest(...parts) {
  const hash = createHash('sha1');
  for (const part of parts) {
    hash.update(typeof part === 'string' ? part : stableStringify(part));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * Digests the compiler's own source.
 *
 * An in-memory cache cannot outlive a change to the compiler -- ES modules are
 * resolved once per process, so editing the compiler means restarting the
 * process that holds this `Map`. The fingerprint is computed anyway, because
 * "the cache is safe because of how the module system happens to work" is not a
 * property worth depending on, and because it is what makes the cache correct
 * if a disk tier is ever added above it.
 *
 * Read once per process and memoised: about 150 files and under two megabytes,
 * which costs a few milliseconds one time rather than once per rebuild.
 * @returns {string} A digest of every compiler source file.
 */
export function compilerFingerprint() {
  if (compilerFingerprintCache) {
    return compilerFingerprintCache;
  }

  const libDir = path.resolve(__dirname, '..');
  const files = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      // A compiler installed read-only, or a directory that vanished mid-walk.
      // A partial fingerprint is still a fingerprint; refusing to build because
      // the cache could not measure itself would be the worse failure.
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        files.push(full);
      }
    }
  };

  walk(libDir);
  files.sort();

  const hash = createHash('sha1');
  for (const file of files) {
    hash.update(path.relative(libDir, file));
    hash.update('\0');
    try {
      hash.update(fs.readFileSync(file));
    } catch {
      hash.update('unreadable');
    }
    hash.update('\0');
  }

  compilerFingerprintCache = hash.digest('hex');
  return compilerFingerprintCache;
}

/**
 * Digests every project-wide input that can affect generated output.
 *
 * Computed once per build rather than once per unit: nothing in it varies
 * between two units of the same build.
 * @param {object} options - The project's identity.
 * @param {string} options.rootDir - The project root.
 * @param {object} options.config - The resolved configuration.
 * @param {object} [options.publicEnv] - `AVX_PUBLIC_*` values the compiler inlines.
 * @returns {string} The fingerprint.
 */
export function createSessionFingerprint({ rootDir, config, publicEnv = {} }) {
  const configPath = path.join(rootDir, 'avenx.config.json');
  let configSource = '';
  try {
    configSource = fs.readFileSync(configPath, 'utf8');
  } catch {
    // No config file: the defaults apply, and `config` already reflects them.
  }

  return digest(rootDir, config, configSource, publicEnv, compilerFingerprint());
}

/**
 * Digests the cross-unit state `parse()` resolves against.
 *
 * Separate from the session fingerprint because it is derived from the source
 * tree rather than from the project's configuration: it changes when a file is
 * added, renamed or deleted, or when a bridge's surface changes, and stays put
 * when the edit is to a file that was already there.
 * @param {object} options - The build's cross-unit state.
 * @param {Map<string, object>} [options.bridges] - Bridge descriptors by path.
 * @param {Set<string>|string[]} [options.componentNames] - Every unit name in the project.
 * @param {Map<string, string[]>} [options.routeParams] - Route parameters by page name.
 * @param {boolean} [options.production] - Whether this is an optimised build.
 * @param {string[]} [options.customVoidTags] - Configured void tags.
 * @returns {string} The fingerprint.
 */
export function createEnvironmentFingerprint({
  bridges = null,
  componentNames = null,
  routeParams = null,
  production = false,
  customVoidTags = [],
}) {
  // Bridge descriptors, not bridge sources: a descriptor is derived from its
  // file, and it is the descriptor -- the declared surface -- that a consumer
  // resolves against. Digesting it means reformatting a bridge does not
  // invalidate its consumers, while renaming anything they can read does.
  const bridgeSurfaces = bridges
    ? [...bridges.entries()].map(([key, descriptor]) => [path.resolve(key), descriptor])
    : [];

  return digest(
    bridgeSurfaces,
    componentNames ? [...componentNames].sort() : [],
    routeParams || new Map(),
    production ? 'production' : 'development',
    [...customVoidTags].sort(),
  );
}

/**
 * Computes the cache key for one unit.
 * @param {object} options - The unit's inputs.
 * @param {string} options.filePath - The unit's source path.
 * @param {'component'|'page'} options.kind - Which kind of unit it is.
 * @param {string} options.source - The unit's source text.
 * @param {string|null} options.styleSource - Its stylesheet's text, or null when it has none.
 * @param {string} options.sessionFingerprint - From {@link createSessionFingerprint}.
 * @param {string} options.environmentFingerprint - From {@link createEnvironmentFingerprint}.
 * @returns {string} The key.
 */
export function createUnitKey({
  filePath,
  kind,
  source,
  styleSource,
  sessionFingerprint,
  environmentFingerprint,
}) {
  return digest(
    path.resolve(filePath),
    kind,
    source,
    styleSource === null || styleSource === undefined ? 'none' : styleSource,
    sessionFingerprint,
    environmentFingerprint,
  );
}

/**
 * Reads a cached unit and refreshes its eviction position.
 * @param {string} key - From {@link createUnitKey}.
 * @returns {object|null} The stored product, or null on a miss.
 */
export function getCachedUnit(key) {
  const hit = store.get(key);

  if (!hit) {
    stats.misses += 1;
    return null;
  }

  stats.hits += 1;
  // Refresh recency: Map preserves insertion order, so re-inserting moves this
  // entry to the back of the eviction queue.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

/**
 * Stores a unit's compilation product.
 * @param {string} key - From {@link createUnitKey}.
 * @param {object} value - The product, as {@link captureUnit} built it.
 * @returns {void}
 */
export function setCachedUnit(key, value) {
  if (store.has(key)) {
    store.delete(key);
  }

  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }

  store.set(key, value);
}

/**
 * Empties the cache.
 *
 * Used by tests, and available to any caller that wants a guaranteed cold
 * compilation.
 * @returns {void}
 */
export function clearIncrementalCache() {
  store.clear();
  stats.hits = 0;
  stats.misses = 0;
}

/**
 * How often the cache has been hit and missed since the last clear.
 * @returns {{hits: number, misses: number, size: number}} The counts.
 */
export function incrementalCacheStats() {
  return { hits: stats.hits, misses: stats.misses, size: store.size };
}

/**
 * How many unit products are currently retained.
 * @returns {number} The entry count.
 */
export function incrementalCacheSize() {
  return store.size;
}

export default {
  compilerFingerprint,
  createSessionFingerprint,
  createEnvironmentFingerprint,
  createUnitKey,
  getCachedUnit,
  setCachedUnit,
  clearIncrementalCache,
  incrementalCacheSize,
  incrementalCacheStats,
};
