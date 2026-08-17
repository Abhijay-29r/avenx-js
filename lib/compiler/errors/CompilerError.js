import { AvenxError } from '../../core/runtime/AvenxError.js';

/**
 * Formats a code frame snippet highlighting an error location with carets (^).
 * @param {string} source - The source code or template content.
 * @param {number} line - 1-based line number of the error.
 * @param {number} column - 1-based column offset of the error.
 * @param {object} [options]
 * @param {number} [options.linesBefore=1] - Context lines to include before.
 * @param {number} [options.linesAfter=1] - Context lines to include after.
 * @param {number} [options.length=1] - Number of carets to render under the error (e.g. ^^^).
 * @returns {string} The formatted visual code frame string.
 */
export function formatCodeFrame(source, line, column, options = {}) {
  if (!source || typeof source !== 'string' || !line || line < 1) {
    return '';
  }

  const lines = source.split(/\r?\n/);
  const totalLines = lines.length;
  if (line > totalLines) {
    return '';
  }

  const linesBefore = options.linesBefore !== undefined ? options.linesBefore : 1;
  const linesAfter = options.linesAfter !== undefined ? options.linesAfter : 1;
  const caretLength = Math.max(1, options.length || 1);

  const startLine = Math.max(1, line - linesBefore);
  const endLine = Math.min(totalLines, line + linesAfter);

  const maxLineNumWidth = String(endLine).length;

  const result = [];
  for (let l = startLine; l <= endLine; l++) {
    const lineNumStr = String(l).padStart(maxLineNumWidth, ' ');
    const lineContent = lines[l - 1];
    result.push(` ${lineNumStr} | ${lineContent}`);

    if (l === line) {
      const col = Math.max(1, Math.min(column || 1, lineContent.length + 1));
      const gutterPadding = ' '.repeat(maxLineNumWidth);
      const spacePadding = ' '.repeat(col - 1);
      const carets = '^'.repeat(caretLength);
      result.push(` ${gutterPadding} | ${spacePadding}${carets}`);
    }
  }

  return result.join('\n');
}

/**
 * Computes 1-based line and column coordinates from a character index in a source string.
 * @param {string} source - The source code or template string.
 * @param {number} index - Character offset.
 * @returns {{ line: number, column: number }}
 */
export function getLineAndColumn(source, index) {
  if (!source || typeof source !== 'string' || index === undefined || index < 0) {
    return { line: 1, column: 1 };
  }
  const safeIndex = Math.min(index, source.length);
  const substring = source.slice(0, safeIndex);
  const lines = substring.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

/**
 * Base error class for all compiler-related errors and warnings in Avenx-JS.
 * Subclasses AvenxError to maintain compatibility with standard error handling.
 * @augments AvenxError
 */
export class CompilerError extends AvenxError {
  /**
   * Creates an instance of CompilerError.
   * @param {string} code - The AvenxErrorCode identifier.
   * @param {...any} args - Arguments to format within the template message, optionally ending with a location options object.
   */
  constructor(code, ...args) {
    let locOptions = null;
    let formatArgs = args;

    if (args.length > 0) {
      const lastArg = args[args.length - 1];
      if (
        lastArg &&
        typeof lastArg === 'object' &&
        !Array.isArray(lastArg) &&
        !(lastArg instanceof Error) &&
        (lastArg.line !== undefined || lastArg.source !== undefined || lastArg.location !== undefined)
      ) {
        locOptions = lastArg.location || lastArg;
        formatArgs = args.slice(0, -1);
      }
    }

    super(code, ...formatArgs);
    /**
     * Custom name identifier for compiler errors.
     * @type {string}
     */
    this.name = 'CompilerError';

    if (locOptions) {
      this.setLocation(locOptions);
    }
  }

  /**
   * Attaches source location information and generates a code frame with carets (^).
   * @param {object} loc - Location options object containing { line, column, source, filename, index, length }.
   * @returns {CompilerError} Returns this error instance for chaining.
   */
  setLocation(loc = {}) {
    let { line, column, source, filename, index, length } = loc;

    if (source && index !== undefined && (!line || !column)) {
      const pos = getLineAndColumn(source, index);
      line = pos.line;
      column = pos.column;
    }

    this.line = line;
    this.column = column;
    this.source = source;
    if (filename) {
      this.filename = filename;
    }

    if (source && line && column) {
      this.frame = formatCodeFrame(source, line, column, { length });
      if (this.frame && !this.message.includes(this.frame)) {
        this.message += `\n\n${this.frame}`;
      }
    }

    return this;
  }

  /**
   * Helper static method to format code frames.
   * @param {string} source
   * @param {number} line
   * @param {number} column
   * @param {object} [options]
   * @returns {string}
   */
  static formatCodeFrame(source, line, column, options) {
    return formatCodeFrame(source, line, column, options);
  }

  /**
   * Helper static method to compute line and column coordinates.
   * @param {string} source
   * @param {number} index
   * @returns {{ line: number, column: number }}
   */
  static getLineAndColumn(source, index) {
    return getLineAndColumn(source, index);
  }
}

