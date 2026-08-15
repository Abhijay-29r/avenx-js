import { AvenxErrorCodes, formatMessage } from '../runtime/AvenxError.js';
import { HtmlEscaper, SafeHtml } from '../security/escapeHtml.js';
import { logger } from '../runtime/AvenxLogger.js';
import { LruCache } from '../utils/LruCache.js';

const templateEscaper = new HtmlEscaper();
const DEFAULT_TEMPLATE_CACHE_CAPACITY = 500;

/**
 * Segment structure for parsed template AST:
 * @typedef {object} TemplateSegment
 * @property {boolean} isExpression - True if this segment is an interpolation expression.
 * @property {string} [value] - Static text content when isExpression is false.
 * @property {string} [expression] - Expression source code when isExpression is true.
 * @property {boolean} [isRaw] - True if raw interpolation {{{ ... }}} was used.
 */

/**
 * Handles the rendering of HTML templates by resolving interpolation expressions.
 * Uses an LruCache to cache parsed template AST segments with bounded capacity.
 */
export class TemplateRenderer {
  /**
   * Constructs the TemplateRenderer with a configurable LRU cache capacity.
   * @param {number|object} [capacityOrConfig] - Maximum LRU cache capacity or configuration object.
   */
  constructor(capacityOrConfig = DEFAULT_TEMPLATE_CACHE_CAPACITY) {
    let capacity = DEFAULT_TEMPLATE_CACHE_CAPACITY;
    if (typeof capacityOrConfig === 'number' && capacityOrConfig > 0) {
      capacity = capacityOrConfig;
    } else if (capacityOrConfig && typeof capacityOrConfig === 'object') {
      if (typeof capacityOrConfig.templateCacheCapacity === 'number' && capacityOrConfig.templateCacheCapacity > 0) {
        capacity = capacityOrConfig.templateCacheCapacity;
      } else if (typeof capacityOrConfig.capacity === 'number' && capacityOrConfig.capacity > 0) {
        capacity = capacityOrConfig.capacity;
      }
    }

    /**
     * Maximum capacity of the LRU cache.
     * @type {number}
     */
    this.capacity = capacity;

    /**
     * LRU Cache storing parsed template AST segments.
     * @type {LruCache}
     */
    this.cache = new LruCache(capacity);
  }

  /**
   * Parses a raw HTML template string into tokenized AST segments.
   * @param {string} template - The HTML template string.
   * @returns {TemplateSegment[]} Array of template segments.
   */
  parseTemplate(template) {
    const segments = [];
    const regex = /\{\{\{\s*(.*?)\s*\}\}\}|\{\{\s*(.*?)\s*\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          isExpression: false,
          value: template.substring(lastIndex, match.index),
        });
      }
      const isRaw = match[1] !== undefined;
      const expression = isRaw ? match[1] : match[2];
      segments.push({
        isExpression: true,
        expression,
        isRaw,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < template.length) {
      segments.push({
        isExpression: false,
        value: template.substring(lastIndex),
      });
    }

    return segments;
  }

  /**
   * Clears the template LRU cache.
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Renders the template by replacing {{ expression }} and {{{ expression }}} with evaluated values.
   * @param {string} template - The HTML template string.
   * @param {function(string): any} resolveExpression - Function to evaluate expressions.
   * @returns {string} The rendered HTML string.
   */
  render(template, resolveExpression) {
    if (!template) return '';

    let segments = this.cache.get(template);
    if (!segments) {
      segments = this.parseTemplate(template);
      this.cache.set(template, segments);
    }

    let result = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.isExpression) {
        result += seg.value;
      } else {
        const expression = seg.expression;
        const isRaw = seg.isRaw;
        try {
          const value = resolveExpression(expression);
          if (value == null) {
            continue;
          }
          if (isRaw || value instanceof SafeHtml) {
            result += String(value);
          } else {
            result += templateEscaper.escape(value);
          }
        } catch (error) {
          if (error instanceof Promise) {
            throw error; // Suspense: bubble up the promise without logging
          }
          if (error && error.code === AvenxErrorCodes.STATE_MUTATION_IN_UPDATE) {
            throw error;
          }
          logger.warn(formatMessage(AvenxErrorCodes.TEMPLATE_RENDER_ERROR, expression, error));
          throw error;
        }
      }
    }

    return this.resolveDynamicAttributes(result, resolveExpression);
  }

  /**
   * Resolves dynamic attribute name binding syntax (:[attrName]="attrValue") in HTML string.
   * @param {string} html - The HTML string.
   * @param {function(string): any} resolveExpression - Function to evaluate expressions.
   * @returns {string} The HTML string with dynamic attributes resolved.
   */
  resolveDynamicAttributes(html, resolveExpression) {
    if (!html || typeof html !== 'string' || !html.includes(':[')) {
      return html;
    }

    const tagRegex = /<([a-zA-Z0-9@/!-][^>]*?)>/g;
    return html.replace(tagRegex, (fullTag, tagInner) => {
      if (tagInner.startsWith('/') || tagInner.startsWith('!') || tagInner.startsWith('?')) {
        return fullTag;
      }

      const dynAttrRegex = /:\[(.*?)\]\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      if (!dynAttrRegex.test(tagInner)) {
        return fullTag;
      }
      dynAttrRegex.lastIndex = 0;

      const activeDynAttrs = [];
      const parts = [];
      let lastIdx = 0;
      let match;

      while ((match = dynAttrRegex.exec(tagInner)) !== null) {
        parts.push(tagInner.substring(lastIdx, match.index));
        const nameExpr = match[1];
        const valExpr = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);

        let resolvedName = null;
        try {
          resolvedName = resolveExpression(nameExpr);
        } catch (error) {
          logger.warn(formatMessage(AvenxErrorCodes.TEMPLATE_RENDER_ERROR, nameExpr, error));
        }

        if (resolvedName != null && String(resolvedName).trim() !== '') {
          const attrName = String(resolvedName).trim();
          let resolvedVal = null;
          if (valExpr !== undefined && valExpr !== null) {
            try {
              resolvedVal = resolveExpression(valExpr);
            } catch (error) {
              logger.warn(formatMessage(AvenxErrorCodes.TEMPLATE_RENDER_ERROR, valExpr, error));
            }
          }

          if (resolvedVal !== false && resolvedVal != null) {
            activeDynAttrs.push(attrName);
            if (resolvedVal === true) {
              parts.push(`${attrName}="true"`);
            } else {
              const escapedVal = templateEscaper.escape(String(resolvedVal));
              parts.push(`${attrName}="${escapedVal}"`);
            }
          } else {
            activeDynAttrs.push(attrName);
          }
        }

        lastIdx = dynAttrRegex.lastIndex;
      }

      parts.push(tagInner.substring(lastIdx));
      let newTagInner = parts.join('');

      if (activeDynAttrs.length > 0) {
        newTagInner += ` data-ax-dyn-attrs="${activeDynAttrs.join(',')}"`;
      }

      return `<${newTagInner}>`;
    });
  }
}
