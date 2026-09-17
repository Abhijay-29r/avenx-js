/**
 * @file markupLexer.js
 * @description The one lexer for Avenx template markup.
 *
 * ## Why one lexer
 *
 * Before this module, a template was read by several scanners that disagreed:
 * `StyleProcessor` applied `@css` with `/<([^>]+)\s+@css…>/`, bind expansion
 * matched `/<(input|textarea|select)\b([^>]*?)>/`, comments were stripped with
 * `/<!--[\s\S]*?-->/`, and the tree parser had its own tag-end and attribute
 * scanners. Each regular expression treated the first `>` as the end of a tag
 * and any `<!--` as a comment, wherever they appeared. A handler such as
 * `@click="count > 3 ? a() : b()"` therefore split the tag in two, and the build
 * reported success while the emitted program described a different template.
 *
 * Every consumer now asks this module where tags, attributes, comments and
 * interpolations are, and edits the source by the spans it reports. There is
 * no second opinion to disagree with.
 *
 * ## Grammar
 *
 * - `<!-- … -->` is a comment. An unterminated one is reported as such.
 * - `</name …>` is a close tag.
 * - `<name …>` is an open tag when `name` starts with a letter or `@`. Anything
 *   else after `<` (a space, a digit, `!`) is text, as in HTML.
 * - Inside text, `{{{ … }}}`, `{{ … }}` and `{% … %}` (with any number of `%`)
 *   are opaque: a `<` inside `{{ a < b }}` is an operator.
 * - Inside an ordinary tag, attributes follow HTML: a quote only opens a value
 *   after `=`, an unquoted value ends at whitespace or `>`, and an interpolation
 *   is opaque wherever it appears. A backslash inside a quoted value escapes the
 *   next character, which is how an expression can contain its own quote
 *   character (`@click='say(\'hi\')'`); this predates the lexer and is kept.
 * - A directive tag (`<@for …>`, `<@if …>`) carries an expression header rather
 *   than attributes. Its end is the first `>` outside quotes and outside
 *   `()`, `[]`, `{}`, and `=>` is never a tag end, so
 *   `<@for r in rows.filter(r => r.n > 1)>` ends where it should. Its header is
 *   still split into attribute tokens for directives that use attribute syntax
 *   (`<@css card />`, `<@fallback as="err">`).
 * - `<script>` and `<style>` contents are raw text.
 *
 * The lexer never throws. Malformed input is reported on the token
 * (`unterminated`) so the compiler can turn it into a located diagnostic, while
 * the tree parser keeps its historical lenient reading.
 * @module lib/core/utils/markupLexer
 */

/**
 * Elements whose content is raw text rather than markup.
 * @type {Set<string>}
 */
export const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

/**
 * @typedef {object} MarkupAttribute
 * @property {string} name - The attribute name exactly as written.
 * @property {string|null} value - The value as written (without quotes), or
 *   null for a valueless attribute.
 * @property {string|null} quote - `"`, `'`, or null when unquoted or valueless.
 * @property {number} start - Offset of the first character of the name.
 * @property {number} end - Offset just past the attribute (past a closing quote).
 * @property {number} nameEnd - Offset just past the name.
 * @property {number} valueStart - Offset of the first value character, or -1.
 * @property {number} valueEnd - Offset just past the last value character, or -1.
 */

/**
 * @typedef {object} MarkupToken
 * @property {'text'|'interpolation'|'comment'|'open'|'close'} type - Token kind.
 * @property {number} start - Offset of the first character.
 * @property {number} end - Offset just past the token.
 * @property {string} [name] - Tag name, for `open` and `close`.
 * @property {number} [nameEnd] - Offset just past the tag name.
 * @property {MarkupAttribute[]} [attrs] - Attributes, for `open`.
 * @property {number} [attrEnd] - Offset where the attribute region ends (before
 *   `/>` or `>`), for `open`.
 * @property {boolean} [selfClosing] - Whether the tag was written `<x />`.
 * @property {boolean} [directive] - Whether the tag name starts with `@`.
 * @property {boolean} [unterminated] - The token runs to the end of the source
 *   without its terminator.
 */

/**
 * Whether a character is HTML whitespace.
 * @param {string} ch - A single character.
 * @returns {boolean} True for space, tab, newline, carriage return or form feed.
 */
function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

/**
 * Whether a character can start a tag name.
 * @param {string} ch - A single character.
 * @returns {boolean} True for an ASCII letter or `@`.
 */
function isTagNameStart(ch) {
  return !!ch && /[A-Za-z@]/.test(ch);
}

/**
 * Whether a character can continue a tag name.
 * @param {string} ch - A single character.
 * @returns {boolean} True for the characters the tree parser has always accepted.
 */
function isTagNameChar(ch) {
  return !!ch && /[A-Za-z0-9@:._-]/.test(ch);
}

/**
 * Returns the end of an interpolation that opens at `start`, or -1.
 *
 * The close is the first matching terminator, which is exactly how
 * {@link module:lib/core/utils/templateUtils.createInterpolationRegex} and the
 * IR read an interpolation. Using a different rule here would let the lexer and
 * the expression reader disagree about where an expression ends.
 *
 * An opener with no terminator is not an interpolation, and neither is one
 * whose terminator comes after another opener: `{{ typo <p>{{ x }}` would
 * otherwise swallow the `<p>` into an expression. Leaving the stray opener as
 * text keeps every tag after it readable.
 * @param {string} source - The source text.
 * @param {number} start - Offset of the `{`.
 * @returns {number} Offset just past the terminator, or -1 when `start` does
 *   not open a terminated interpolation.
 */
export function interpolationEnd(source, start) {
  if (source[start] !== '{') return -1;
  const next = source[start + 1];

  if (next === '{') {
    const triple = source[start + 2] === '{';
    const bodyStart = start + (triple ? 3 : 2);
    const close = triple ? '}}}' : '}}';
    const at = source.indexOf(close, bodyStart);
    if (at === -1) return -1;
    const nested = source.indexOf('{{', bodyStart);
    return nested !== -1 && nested < at ? -1 : at + close.length;
  }

  if (next === '%') {
    let percents = 1;
    while (source[start + 1 + percents] === '%') percents++;
    const bodyStart = start + 1 + percents;
    const close = `${'%'.repeat(percents)}}`;
    const at = source.indexOf(close, bodyStart);
    if (at === -1) return -1;
    const nested = source.indexOf('{%', bodyStart);
    return nested !== -1 && nested < at ? -1 : at + close.length;
  }

  return -1;
}

/**
 * Reads the attributes of an ordinary tag, and finds where the tag ends.
 * @param {string} source - The source text.
 * @param {number} from - Offset just past the tag name.
 * @param {number} [limit] - Offset the scan may not reach. A directive header
 *   is split into attributes within the extent its own scan already decided.
 * @returns {{attrs: MarkupAttribute[], end: number, attrEnd: number,
 *   selfClosing: boolean, unterminated: boolean}} The tag's attribute tokens
 *   and the offset just past its `>`.
 */
function readElementTag(source, from, limit = source.length) {
  /** @type {MarkupAttribute[]} */
  const attrs = [];
  const length = limit;
  let i = from;
  // An interpolation that would close beyond the limit does not close here.
  const interpolated = (at) => {
    const end = interpolationEnd(source, at);
    return end !== -1 && end <= length ? end : -1;
  };

  while (i < length) {
    while (i < length && isSpace(source[i])) i++;
    if (i >= length) break;

    const ch = source[i];

    if (ch === '>') {
      const selfClosing = lastNonSpaceBefore(source, i, from) === '/';
      return { attrs, end: i + 1, attrEnd: selfClosing ? slashOffset(source, i) : i, selfClosing, unterminated: false };
    }

    if (ch === '/') {
      i++;
      continue;
    }

    // An interpolation in attribute position (`<div {{ attrs }}>`) is one
    // opaque token; its content is an expression, not attribute syntax.
    const opaqueEnd = interpolated(i);
    if (opaqueEnd !== -1) {
      attrs.push({
        name: source.slice(i, opaqueEnd),
        value: null,
        quote: null,
        start: i,
        end: opaqueEnd,
        nameEnd: opaqueEnd,
        valueStart: -1,
        valueEnd: -1,
      });
      i = opaqueEnd;
      continue;
    }

    const nameStart = i;
    while (i < length) {
      const c = source[i];
      if (isSpace(c) || c === '>' || c === '=' || (c === '/' && source[i + 1] === '>')) break;
      if (c === '{' && interpolated(i) !== -1) {
        i = interpolated(i);
        continue;
      }
      i++;
    }
    // A lone `=` or quote where a name should be is not an attribute; step over
    // it so malformed input can never stall the scan.
    if (i === nameStart) {
      i++;
      continue;
    }
    const nameEnd = i;

    let look = i;
    while (look < length && isSpace(source[look])) look++;

    if (source[look] !== '=') {
      attrs.push({
        name: source.slice(nameStart, nameEnd),
        value: null,
        quote: null,
        start: nameStart,
        end: nameEnd,
        nameEnd,
        valueStart: -1,
        valueEnd: -1,
      });
      continue;
    }

    i = look + 1;
    while (i < length && isSpace(source[i])) i++;

    const quote = source[i];
    if (quote === '"' || quote === "'") {
      const valueStart = i + 1;
      let j = valueStart;
      while (j < length && source[j] !== quote) {
        j += source[j] === '\\' ? 2 : 1;
      }
      if (j >= length) {
        attrs.push({
          name: source.slice(nameStart, nameEnd),
          value: source.slice(valueStart),
          quote,
          start: nameStart,
          end: length,
          nameEnd,
          valueStart,
          valueEnd: length,
        });
        return { attrs, end: length, attrEnd: length, selfClosing: false, unterminated: true };
      }
      attrs.push({
        name: source.slice(nameStart, nameEnd),
        value: source.slice(valueStart, j),
        quote,
        start: nameStart,
        end: j + 1,
        nameEnd,
        valueStart,
        valueEnd: j,
      });
      i = j + 1;
      continue;
    }

    const valueStart = i;
    while (i < length && !isSpace(source[i]) && source[i] !== '>') {
      const valueInterpolation = interpolated(i);
      i = valueInterpolation !== -1 ? valueInterpolation : i + 1;
    }
    // `<img src=a/>`: the slash before `>` closes the tag, as the tree parser
    // has always read it, rather than belonging to the value.
    let valueEnd = i;
    if (source[i] === '>' && source[i - 1] === '/' && valueEnd - 1 > valueStart) {
      valueEnd -= 1;
    }
    attrs.push({
      name: source.slice(nameStart, nameEnd),
      value: source.slice(valueStart, valueEnd),
      quote: null,
      start: nameStart,
      end: valueEnd,
      nameEnd,
      valueStart,
      valueEnd,
    });
    i = valueEnd;
  }

  return { attrs, end: length, attrEnd: length, selfClosing: false, unterminated: true };
}

/**
 * Returns the last non-whitespace character before `index`, not before `floor`.
 * @param {string} source - The source text.
 * @param {number} index - Offset to search back from (exclusive).
 * @param {number} floor - Lowest offset to consider.
 * @returns {string} The character, or '' when there is none.
 */
function lastNonSpaceBefore(source, index, floor) {
  let i = index - 1;
  while (i >= floor && isSpace(source[i])) i--;
  return i >= floor ? source[i] : '';
}

/**
 * Returns the offset of the `/` of a `/>` ending at `gt`.
 * @param {string} source - The source text.
 * @param {number} gt - Offset of the `>`.
 * @returns {number} Offset of the slash.
 */
function slashOffset(source, gt) {
  let i = gt - 1;
  while (i > 0 && isSpace(source[i])) i--;
  return i;
}

/**
 * Finds the end of a directive tag's header.
 * @param {string} source - The source text.
 * @param {number} from - Offset just past the tag name.
 * @returns {{end: number, attrEnd: number, selfClosing: boolean, unterminated: boolean}}
 *   Offset just past the `>`, and where the header ends.
 */
function readDirectiveTag(source, from) {
  let quote = null;
  let depth = 0;

  for (let i = from; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth > 0) depth--;
      continue;
    }
    if (ch === '=' && source[i + 1] === '>') {
      i++;
      continue;
    }
    if (ch === '>' && depth === 0) {
      const selfClosing = lastNonSpaceBefore(source, i, from) === '/';
      return { end: i + 1, attrEnd: selfClosing ? slashOffset(source, i) : i, selfClosing, unterminated: false };
    }
  }

  return { end: source.length, attrEnd: source.length, selfClosing: false, unterminated: true };
}

/**
 * Finds the `>` that ends the tag opening at `start`.
 *
 * Exposed for callers that only need a tag's extent. It follows exactly the
 * rules {@link tokenizeMarkup} uses.
 * @param {string} source - The source text.
 * @param {number} start - Offset of the `<`.
 * @returns {number} Offset of the closing `>`, or -1 when the tag is unterminated
 *   or `start` does not open a tag.
 */
export function findTagEnd(source, start) {
  if (source[start] !== '<' || !isTagNameStart(source[start + 1])) return -1;
  let nameEnd = start + 1;
  while (nameEnd < source.length && isTagNameChar(source[nameEnd])) nameEnd++;
  const read = source[start + 1] === '@' ? readDirectiveTag(source, nameEnd) : readElementTag(source, nameEnd);
  return read.unterminated ? -1 : read.end - 1;
}

/**
 * Splits template markup into tokens.
 *
 * Adjacent tokens tile the source exactly: `tokens[n].end === tokens[n + 1].start`,
 * the first starts at 0 and the last ends at `source.length`. Concatenating
 * `source.slice(t.start, t.end)` over the tokens reproduces the source.
 * @param {string} source - Template markup.
 * @returns {MarkupToken[]} The tokens, in source order.
 */
export function tokenizeMarkup(source) {
  /** @type {MarkupToken[]} */
  const tokens = [];
  if (typeof source !== 'string' || source.length === 0) return tokens;

  const length = source.length;
  let i = 0;
  let textStart = 0;

  const flushText = (until) => {
    if (until > textStart) {
      tokens.push({ type: 'text', start: textStart, end: until });
    }
  };

  while (i < length) {
    const ch = source[i];

    if (ch === '{') {
      const end = interpolationEnd(source, i);
      if (end !== -1) {
        flushText(i);
        tokens.push({ type: 'interpolation', start: i, end });
        i = end;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }

    if (ch !== '<') {
      i++;
      continue;
    }

    if (source.startsWith('<!--', i)) {
      flushText(i);
      const close = source.indexOf('-->', i + 4);
      const end = close === -1 ? length : close + 3;
      tokens.push(close === -1 ? { type: 'comment', start: i, end, unterminated: true } : { type: 'comment', start: i, end });
      i = end;
      textStart = i;
      continue;
    }

    if (source[i + 1] === '/' && isTagNameStart(source[i + 2])) {
      flushText(i);
      let nameEnd = i + 2;
      while (nameEnd < length && isTagNameChar(source[nameEnd])) nameEnd++;
      // A close tag has no attributes, so its end is the next `>`, exactly as
      // the tree parser has always read it.
      const gt = source.indexOf('>', nameEnd);
      const token = { type: 'close', name: source.slice(i + 2, nameEnd), start: i, end: gt === -1 ? length : gt + 1, nameEnd };
      if (gt === -1) token.unterminated = true;
      tokens.push(token);
      i = token.end;
      textStart = i;
      continue;
    }

    if (!isTagNameStart(source[i + 1])) {
      i++;
      continue;
    }

    let nameEnd = i + 1;
    while (nameEnd < length && isTagNameChar(source[nameEnd])) nameEnd++;
    const after = source[nameEnd];
    // `<a"b">` is not a tag in the tree parser's reading either: a tag name is
    // followed by whitespace, `/`, `>` or the end of the source.
    if (after !== undefined && !isSpace(after) && after !== '/' && after !== '>') {
      i++;
      continue;
    }

    flushText(i);
    const name = source.slice(i + 1, nameEnd);
    const directive = name[0] === '@';

    /** @type {MarkupToken} */
    let token;
    if (directive) {
      const read = readDirectiveTag(source, nameEnd);
      token = {
        type: 'open',
        name,
        start: i,
        end: read.end,
        nameEnd,
        attrEnd: read.attrEnd,
        selfClosing: read.selfClosing,
        directive: true,
        attrs: read.unterminated ? [] : readElementTag(source, nameEnd, read.attrEnd).attrs,
      };
      if (read.unterminated) token.unterminated = true;
    } else {
      const read = readElementTag(source, nameEnd);
      token = {
        type: 'open',
        name,
        start: i,
        end: read.end,
        nameEnd,
        attrEnd: read.attrEnd,
        selfClosing: read.selfClosing,
        directive: false,
        attrs: read.attrs,
      };
      if (read.unterminated) token.unterminated = true;
    }
    tokens.push(token);
    i = token.end;
    textStart = i;

    if (!directive && !token.selfClosing && !token.unterminated && RAW_TEXT_ELEMENTS.has(name.toLowerCase())) {
      const closeAt = source.toLowerCase().indexOf(`</${name.toLowerCase()}`, i);
      const rawEnd = closeAt === -1 ? length : closeAt;
      if (rawEnd > i) {
        tokens.push({ type: 'text', start: i, end: rawEnd });
      }
      i = rawEnd;
      textStart = i;
    }
  }

  flushText(length);
  return tokens;
}

/**
 * Applies non-overlapping edits to a source string.
 * @param {string} source - The original text.
 * @param {Array<{start: number, end: number, text: string}>} edits - Replacements
 *   by offset. Offsets refer to the original text.
 * @returns {string} The edited text.
 * @throws {Error} When two edits overlap, which is always a caller defect.
 */
export function applyEdits(source, edits) {
  if (!edits || edits.length === 0) return source;
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let cursor = 0;
  for (const edit of sorted) {
    if (edit.start < cursor) {
      throw new Error(`Overlapping markup edits at offset ${edit.start}`);
    }
    out += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return out + source.slice(cursor);
}

/**
 * Returns the offset where the whitespace before `index` begins.
 * @param {string} source - The source text.
 * @param {number} index - Offset to search back from.
 * @returns {number} The first offset of the whitespace run ending at `index`.
 */
export function leadingSpaceStart(source, index) {
  let i = index;
  while (i > 0 && isSpace(source[i - 1])) i--;
  return i;
}

/**
 * Quotes an attribute value with a quote character it does not contain.
 *
 * Generated attributes carry expressions, and an expression may contain either
 * quote character. The tree parser does not decode character references, so an
 * escaped `&quot;` would reach the expression compiler as those six characters.
 * Choosing the other quote keeps the value verbatim.
 * @param {string} value - The attribute value.
 * @returns {string|null} The quoted value, or null when it contains both quote
 *   characters and cannot be written verbatim.
 */
export function quoteAttributeValue(value) {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return null;
}
