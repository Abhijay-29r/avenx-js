/**
 * @file colors.js
 * @description Zero-dependency ANSI styling helpers for the Avenx CLI.
 *
 * Styles are applied only when the active terminal can render them. Detection
 * follows the widely adopted conventions so that piped output, CI logs, and
 * `--json` consumers keep receiving clean, parseable text:
 *
 * - `--no-color` / `--no-colors` argument  → always disabled
 * - `NO_COLOR` environment variable        → always disabled (https://no-color.org)
 * - `FORCE_COLOR` environment variable     → enabled unless set to `0`/`false`
 * - `TERM=dumb`                            → disabled
 * - non-TTY stdout (pipes, files, CI)      → disabled
 *
 * When styling is disabled every helper returns the plain string unchanged,
 * so call sites never need to branch on color support themselves.
 */

/**
 * Determines whether ANSI escape codes should be emitted for this process.
 * @returns {boolean} True when the current stdout stream can render colors.
 */
export function detectColorSupport() {
  const argv = process.argv || [];
  if (argv.includes('--no-color') || argv.includes('--no-colors')) {
    return false;
  }

  const env = process.env || {};
  if (typeof env.NO_COLOR === 'string' && env.NO_COLOR !== '') {
    return false;
  }
  if (typeof env.FORCE_COLOR === 'string' && env.FORCE_COLOR !== '') {
    return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false';
  }
  if (env.TERM === 'dumb') {
    return false;
  }

  const stream = process.stdout;
  if (!stream || !stream.isTTY) {
    return false;
  }
  if (typeof stream.hasColors === 'function') {
    return stream.hasColors();
  }
  return true;
}

let colorEnabled = detectColorSupport();

/**
 * Reports whether styling helpers currently emit ANSI escape codes.
 * @returns {boolean}
 */
export function isColorEnabled() {
  return colorEnabled;
}

/**
 * Overrides color support, mainly for tests and explicit CLI flags.
 * Call without arguments to re-run the automatic detection.
 * @param {boolean} [value] - Force enable (true) or disable (false).
 * @returns {boolean} The resolved state.
 */
export function setColorEnabled(value) {
  colorEnabled = value === undefined ? detectColorSupport() : Boolean(value);
  return colorEnabled;
}

/**
 * Builds a styling function for an ANSI open/close code pair.
 * Closing with the attribute-specific reset (instead of a full reset) keeps
 * nested styles such as `bold(cyan('text'))` intact.
 * @param {number} open - The ANSI code that enables the style.
 * @param {number} close - The ANSI code that disables just that style.
 * @returns {function(string): string} The styling function.
 */
function style(open, close) {
  const openCode = `\x1b[${open}m`;
  const closeCode = `\x1b[${close}m`;
  return (text) => (colorEnabled ? `${openCode}${text}${closeCode}` : String(text));
}

/** Bold text, used for section headings. */
export const bold = style(1, 22);
/** Dimmed text, used for secondary details. */
export const dim = style(2, 22);
/** Red text, reserved for errors and failed checks. */
export const red = style(31, 39);
/** Green text, reserved for successful actions. */
export const green = style(32, 39);
/** Yellow text, reserved for warnings. */
export const yellow = style(33, 39);
/** Blue text, used for informational notices. */
export const blue = style(34, 39);
/** Cyan text, used for headings and highlighted values. */
export const cyan = style(36, 39);
/** Gray text, used for descriptions and hints. */
export const gray = style(90, 39);

/**
 * Creates an AvenxLogger formatter that tints diagnostics by severity:
 * warnings yellow and errors red, leaving informational build output untouched.
 *
 * The formatter returns the original argument list (no `[Avenx level]` prefix),
 * matching the compiler's existing CLI output format, and only styles string
 * arguments so Error objects and structured context keep their shape.
 * @returns {function(string, any[]): any[]} A formatter for `logger.configure`.
 */
export function createSeverityFormatter() {
  return (level, args) => {
    const tint = level === 'warn' ? yellow : level === 'error' || level === 'fatal' ? red : null;
    if (!tint || !Array.isArray(args)) {
      return args;
    }
    return args.map((arg) => (typeof arg === 'string' ? tint(arg) : arg));
  };
}
