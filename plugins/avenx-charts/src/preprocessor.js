/**
 * Template Preprocessor for Avenx Charts
 * Converts declarative <chart.* ... /> syntax into Avenx component mount elements.
 * @module plugins/avenx-charts/src/preprocessor
 */

/**
 * Parses raw attribute strings from tags into a key-value dictionary.
 * Supports boolean attributes (e.g. `grid`, `legend`, `tooltip`),
 * expression bindings (e.g. `data={sales}` or `data="{{ sales }}"`),
 * and standard string attributes (e.g. `x="month"`).
 * @param {string} attrStr
 * @returns {Record<string, string>}
 */
export function parseChartAttributes(attrStr) {
  const attrs = {};
  if (!attrStr) return attrs;

  const len = attrStr.length;
  let i = 0;

  const isWhitespace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

  while (i < len) {
    while (i < len && isWhitespace(attrStr[i])) i++;
    if (i >= len) break;

    // Read attribute name
    const nameStart = i;
    while (i < len && /[a-zA-Z0-9_:.\-[\]]/.test(attrStr[i])) i++;
    if (i === nameStart) {
      i++;
      continue;
    }
    const name = attrStr.slice(nameStart, i);

    while (i < len && isWhitespace(attrStr[i])) i++;

    if (i < len && attrStr[i] === '=') {
      i++; // skip '='
      while (i < len && isWhitespace(attrStr[i])) i++;

      if (i >= len) break;

      const firstChar = attrStr[i];
      if (firstChar === '"' || firstChar === "'") {
        const quote = firstChar;
        i++;
        let val = '';
        while (i < len) {
          const ch = attrStr[i];
          if (ch === '\\' && i + 1 < len) {
            val += ch + attrStr[i + 1];
            i += 2;
            continue;
          }
          if (ch === quote) {
            i++;
            break;
          }
          val += ch;
          i++;
        }
        attrs[name] = val;
      } else if (firstChar === '{') {
        // Braced expression: data={sales} or data={{ sales }}
        let depth = 0;
        let val = '';
        while (i < len) {
          const ch = attrStr[i];
          if (ch === '{') depth++;
          if (ch === '}') {
            depth--;
            val += ch;
            i++;
            if (depth === 0) break;
            continue;
          }
          val += ch;
          i++;
        }
        attrs[name] = val;
      } else {
        // Unquoted value
        const valStart = i;
        while (i < len && !isWhitespace(attrStr[i]) && attrStr[i] !== '>') i++;
        attrs[name] = attrStr.slice(valStart, i);
      }
    } else {
      // Valueless boolean attribute (e.g. grid, legend, tooltip)
      attrs[name] = 'true';
    }
  }

  return attrs;
}

/**
 * Transforms `<chart.type ... />` tags into `<div data-avenx-comp="chart.type" ...></div>`.
 * @param {string} template - The raw component template.
 * @returns {string} Processed template.
 */
export function chartsPreprocessor(template) {
  if (!template || typeof template !== 'string') return template;

  // Regex matching <chart.line ... />, <chart:line ... />, <chart-line ... />
  // and their pairing closing tags
  const chartTagRegex = /<chart[.:-]([a-zA-Z0-9]+)\b([\s\S]*?)(?:\/>|>(?:[\s\S]*?)<\/chart[.:-]\1>)/gi;

  return template.replace(chartTagRegex, (match, chartType, rawAttrs) => {
    const canonicalType = chartType.toLowerCase();
    const compTag = `chart.${canonicalType}`;
    const attrs = parseChartAttributes(rawAttrs);

    const propsList = [];
    const othersList = [];

    for (const [key, val] of Object.entries(attrs)) {
      if (key.startsWith('@')) {
        othersList.push(`${key}="${val.replace(/"/g, '&quot;')}"`);
      } else {
        let propExpr;
        const trimmed = val.trim();

        if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
          propExpr = trimmed.slice(2, -2).trim();
        } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          propExpr = trimmed.slice(1, -1).trim();
        } else if (
          trimmed === 'true' ||
          trimmed === 'false' ||
          trimmed === 'null' ||
          (trimmed !== '' && !isNaN(trimmed))
        ) {
          propExpr = trimmed;
        } else {
          propExpr = `'${trimmed.replace(/'/g, "\\'")}'`;
        }

        propsList.push(`data-props-${key}="${propExpr}"`);
      }
    }

    const propsAttr = propsList.length > 0 ? ` ${propsList.join(' ')}` : '';
    const othersAttr = othersList.length > 0 ? ` ${othersList.join(' ')}` : '';

    return `<div data-avenx-comp="${compTag}"${propsAttr}${othersAttr}></div>`;
  });
}
