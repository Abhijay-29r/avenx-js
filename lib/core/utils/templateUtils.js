/**
 * Creates a fresh regex matching template interpolations — both the raw
 * triple-brace form and the escaped double-brace form.
 *
 * Expressions may span multiple lines (a long ternary or object literal wraps
 * naturally, and formatters will wrap them), so the pattern must not stop at a
 * newline. The compiler and the runtime share this single definition: when the
 * two sides used different patterns, a wrapped expression passed compile-time
 * validation and then rendered as literal braces at runtime with no diagnostic.
 *
 * A new instance is returned on every call because the regex is global and
 * callers rely on their own `lastIndex`.
 * @returns {RegExp} A fresh global interpolation regex.
 */
export function createInterpolationRegex() {
  return /\{\{\{\s*([\s\S]*?)\s*\}\}\}|\{\{\s*([\s\S]*?)\s*\}\}/g;
}

/**
 * Processes data-ax-bind attributes on input, textarea, and select elements.
 * Converts data-ax-bind="expr" to value="{{ expr }}" and event listener.
 * @param {string} template - The template string.
 * @returns {string} The processed template.
 */
export function processBindDirectives(template) {
  if (typeof template !== 'string') return template;
  const tagRegex = /<(input|textarea|select)\b([^>]*?)>/gi;
  return template.replace(tagRegex, (match, tagName, attrs) => {
    const bindRegex = /\bdata-ax-bind\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
    const bindMatch = attrs.match(bindRegex);
    if (!bindMatch) {
      return match;
    }

    const bindExpr = (bindMatch[1] !== undefined ? bindMatch[1] : bindMatch[2]).trim();
    let cleanAttrs = attrs.replace(bindRegex, '').trim();

    let isSelfClosing = false;
    if (cleanAttrs.endsWith('/')) {
      isSelfClosing = true;
      cleanAttrs = cleanAttrs.slice(0, -1).trim();
    }

    if (tagName.toLowerCase() === 'input') {
      const typeRegex = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
      const typeMatch = attrs.match(typeRegex);
      const type = typeMatch ? (typeMatch[1] !== undefined ? typeMatch[1] : typeMatch[2]).toLowerCase() : 'text';

      if (type === 'checkbox' || type === 'radio') {
        // Remove existing checked attribute since data-ax-bind manages it
        cleanAttrs = cleanAttrs.replace(/\bchecked\b(\s*=\s*(?:"[^"]*"|'[^']*'))?/gi, '').trim();

        const valueRegex = /\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
        const valueMatch = attrs.match(valueRegex);
        const rawValue = valueMatch ? (valueMatch[1] !== undefined ? valueMatch[1] : valueMatch[2]) : null;

        const getJsValue = (valStr) => {
          if (valStr === null || valStr === undefined) return "'on'";
          const trimmed = valStr.trim();
          if (trimmed.includes('{{')) {
            return trimmed.replace(/\{\{\s*|\s*\}\}/g, '');
          }
          return `'${trimmed.replace(/'/g, "\\'")}'`;
        };

        const jsValue = getJsValue(rawValue);

        const checkedAttr =
          type === 'checkbox'
            ? `checked="{{ Array.isArray(${bindExpr}) ? (${bindExpr}).includes(${jsValue}) : !!(${bindExpr}) }}"`
            : `checked="{{ (${bindExpr}) === ${jsValue} }}"`;

        const eventAttr =
          type === 'checkbox'
            ? `@change="Array.isArray(${bindExpr}) ? (event.target.checked ? (!(${bindExpr}).includes(${jsValue}) ? (${bindExpr}).push(${jsValue}) : null) : ((${bindExpr}).includes(${jsValue}) ? (${bindExpr}).splice((${bindExpr}).indexOf(${jsValue}), 1) : null)) : (${bindExpr} = event.target.checked)"`
            : `@change="${bindExpr} = event.target.value"`;

        const suffix = isSelfClosing ? ' />' : '>';
        return `<input ${cleanAttrs} ${checkedAttr} ${eventAttr}`.trim().replace(/\s+/g, ' ') + suffix;
      }
    }

    const eventName = tagName.toLowerCase() === 'select' ? 'change' : 'input';
    const valueAttr = `value="{{ ${bindExpr} }}"`;
    const eventAttr = `@${eventName}="${bindExpr} = event.target.value"`;

    const suffix = isSelfClosing ? ' />' : '>';
    return `<${tagName} ${cleanAttrs} ${valueAttr} ${eventAttr}`.trim().replace(/\s+/g, ' ') + suffix;
  });
}
