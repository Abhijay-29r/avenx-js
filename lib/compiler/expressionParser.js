import { AvenxErrorCodes } from '../core/runtime/AvenxError.js';
import { TemplateValidationError } from './errors/TemplateValidationError.js';
import { reportWarning } from './utils/warningReporter.js';

/**
 * ExpressionParser is responsible for extracting state, computed properties,
 * and methods from Avenx component source code.
 */
class ExpressionParser {
  /**
   * @param {object} [config] - Project configuration object.
   */
  constructor(config = null) {
    this.config = config;
  }

  /**
   * Extracts the initial state from <state /> tags.
   * @param {string} content - The component source code.
   * @param {object} [config] - Optional override configuration object.
   * @returns {object} The extracted state object.
   */
  parseState(content, config = null) {
    const activeConfig = config || this.config;
    const state = {};
    const stateTags = content.match(/<state\s+[\s\S]*?\s*\/>/g) || [];
    if (stateTags.length > 1) {
      reportWarning(
        AvenxErrorCodes.COMPILER_MULTIPLE_STATE_TAGS,
        new TemplateValidationError(AvenxErrorCodes.COMPILER_MULTIPLE_STATE_TAGS),
        activeConfig,
      );
    }
    const match = content.match(/<state\s+([\s\S]*?)\s*\/>/);
    if (match) {
      const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let m;
      while ((m = attrRegex.exec(match[1])) !== null) {
        const k = m[1];
        const val = m[2] !== undefined ? m[2] : m[3];
        state[k] = this.#coerceValue(val);
      }
    }
    return state;
  }

  /**
   * Coerces a string value to its proper JavaScript type.
   * @param {string} val - The raw string value.
   * @returns {any} The coerced value.
   * @private
   */
  #coerceValue(val) {
    const trimmed = val.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed !== '' && !isNaN(trimmed)) return Number(trimmed);

    try {
      return JSON.parse(val);
    } catch {
      try {
        return JSON.parse(val.replace(/'/g, '"'));
      } catch {
        return val;
      }
    }
  }

  /**
   * Extracts computed property definitions from <computed /> tags.
   * @param {string} content - The component source code.
   * @returns {object} A map of computed property names to their expressions.
   */
  parseComputed(content) {
    const computed = {};
    const regex = /<computed\s+([\s\S]*?)\s*\/>/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attrMatch;
      let name = null;
      let value = null;
      while ((attrMatch = attrRegex.exec(m[1])) !== null) {
        const k = attrMatch[1];
        const val = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
        if (k === 'name') name = val;
        if (k === 'value') value = val;
      }
      if (name && value !== null) {
        computed[name] = value;
      }
    }
    return computed;
  }

  /**
   * Extracts method definitions from <action /> tags.
   * @param {string} content - The component source code.
   * @returns {object} A map of method names to their source code.
   */
  parseMethods(content) {
    const methods = {};
    const actionRegex = /<action\s+([\s\S]*?)>([\s\S]*?)<\/action>/g;
    let m;
    while ((m = actionRegex.exec(content)) !== null) {
      const attrs = m[1];
      const body = m[2];
      const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attrMatch;
      let name = null;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const k = attrMatch[1];
        const val = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
        if (k === 'name') {
          name = val;
          break;
        }
      }
      if (name) {
        methods[name] = body.trim();
      }
    }
    return methods;
  }

  /**
   * Extracts resource definitions from <resource /> tags.
   * @param {string} content - The component source code.
   * @returns {object} A map of resource names to their handler expressions.
   */
  parseResources(content) {
    const resources = {};
    const regex = /<resource\s+([\s\S]*?)\s*\/>/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attrMatch;
      let name = null;
      let handler = null;
      while ((attrMatch = attrRegex.exec(m[1])) !== null) {
        const k = attrMatch[1];
        const val = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
        if (k === 'name') name = val;
        if (k === 'handler') handler = val;
      }
      if (name && handler !== null) {
        resources[name] = handler;
      }
    }
    return resources;
  }
}

export default ExpressionParser;
