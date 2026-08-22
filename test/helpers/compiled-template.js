/**
 * Test helper for reading the compiled template back out of generated
 * component/page source.
 *
 * The compiler emits the template as a JSON string literal, so quotes inside it
 * are backslash-escaped in the generated source. Tests that care about the
 * template's markup should decode it first rather than matching the literal's
 * encoding, which is an implementation detail of code generation.
 */

/**
 * Extracts and decodes the template argument from generated component source.
 * @param {string} generated - Generated JavaScript emitted by ComponentParser.
 * @returns {string} The decoded template string, or '' when none was found.
 */
export function extractCompiledTemplate(generated) {
  if (typeof generated !== 'string') return '';
  const match = generated.match(/bridges,\s*("(?:[^"\\]|\\.)*")/);
  if (!match) return '';
  try {
    return JSON.parse(match[1]);
  } catch {
    return '';
  }
}
