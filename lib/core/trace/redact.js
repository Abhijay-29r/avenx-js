/**
 * @file redact.js
 * @description Property-path redaction for traces.
 *
 * A trace records real application state, which means it records whatever the
 * user typed. Redaction happens at *record* time, not at export time: a value
 * a rule matches is never written into the buffer at all, so a trace cannot
 * leak a secret that a later export step forgot to strip.
 *
 * Patterns are matched against the same dotted property paths the reactive
 * system already produces (see `getPropertyPath` in `reactive/watcher.js`), so
 * `auth.token` and `cart.items.2.cardNumber` are both addressable.
 * @module lib/core/trace/redact
 */

import { REDACTED } from './schema.js';

/**
 * Escapes the regular-expression metacharacters in a literal path segment.
 * @param {string} segment - A literal segment.
 * @returns {string} The escaped segment.
 */
function escapeSegment(segment) {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles one redaction pattern into a matcher.
 *
 * Supported syntax, deliberately small:
 *
 * - `auth.token` — that exact path.
 * - `auth.*` — any single segment under `auth`.
 * - `*.password` — `password` under any single segment.
 * - `auth.**` — `auth` and everything beneath it, at any depth.
 *
 * A pattern that matches a path also redacts everything nested below it: a
 * rule for `auth.token` must not be defeated by the value happening to be an
 * object. That also makes `auth` and `auth.**` equivalent, which is why `**`
 * needs no special handling beyond ending the pattern.
 * @param {string} pattern - The pattern source.
 * @returns {RegExp} A matcher anchored to the whole path.
 */
function compilePattern(pattern) {
  const parts = [];
  for (const segment of String(pattern).split('.')) {
    if (segment === '**') {
      break;
    }
    parts.push(segment === '*' ? '[^.]+' : escapeSegment(segment));
  }

  if (parts.length === 0) {
    return /^.*$/;
  }
  return new RegExp(`^${parts.join('\\.')}(?:\\..*)?$`);
}

/**
 * A compiled set of redaction rules.
 *
 * Held per recorder rather than globally, so a test can record with different
 * rules than the dev server without leaking configuration between them.
 */
export class Redactor {
  /**
   * @param {string[]} [patterns] - Redaction patterns from `avenx.config.json` or the runtime API.
   */
  constructor(patterns = []) {
    /**
     * The patterns as written, kept so an exported trace can declare what was
     * withheld from it.
     * @type {string[]}
     */
    this.patterns = [];
    /** @type {RegExp[]} */
    this.matchers = [];
    /**
     * True once a value has actually been withheld. A trace that declares
     * rules but never matched one is not a redacted trace.
     * @type {boolean}
     */
    this.applied = false;
    /** @type {Set<string>} */
    this.matchedPaths = new Set();

    for (const pattern of patterns) {
      this.add(pattern);
    }
  }

  /**
   * Registers an additional pattern.
   * @param {string} pattern - The pattern source.
   * @returns {Redactor} This redactor, for chaining.
   */
  add(pattern) {
    if (typeof pattern !== 'string' || pattern.trim() === '') {
      return this;
    }
    const trimmed = pattern.trim();
    if (this.patterns.includes(trimmed)) {
      return this;
    }
    this.patterns.push(trimmed);
    this.matchers.push(compilePattern(trimmed));
    return this;
  }

  /**
   * Whether this redactor has any rules at all. Hot paths check this first, so
   * an unconfigured recorder pays nothing for the feature.
   * @returns {boolean}
   */
  get isEmpty() {
    return this.matchers.length === 0;
  }

  /**
   * Whether a property path must be withheld.
   * @param {string} path - A dotted property path, e.g. `auth.token`.
   * @returns {boolean}
   */
  matches(path) {
    if (this.matchers.length === 0 || typeof path !== 'string' || path === '') {
      return false;
    }
    for (const matcher of this.matchers) {
      if (matcher.test(path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Notes that a rule fired for a path.
   *
   * Separate from {@link Redactor#matches} because capture cannot detect a
   * redaction by comparing values: `NaN !== NaN` would make every NaN look
   * like a withheld value.
   * @param {string} path - The path a rule matched.
   */
  markApplied(path) {
    this.applied = true;
    this.matchedPaths.add(path);
  }

  /**
   * Returns the value to record for a path: the value itself, or the redaction
   * placeholder when a rule matched.
   * @param {string} path - The property path the value sits at.
   * @param {any} value - The candidate value.
   * @returns {any} What may be recorded.
   */
  guard(path, value) {
    if (this.matches(path)) {
      this.markApplied(path);
      return REDACTED;
    }
    return value;
  }
}

/**
 * A redactor with no rules, shared by callers that have not configured any.
 * @type {Redactor}
 */
export const NO_REDACTION = new Redactor();
