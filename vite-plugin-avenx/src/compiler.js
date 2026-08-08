import fs from 'node:fs';
import path from 'node:path';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import { wrapComponent, wrapPage } from './wrapper.js';
import { generateTemplateSourceMap } from './sourcemap.js';

/**
 * Creates an Avenx compiler instance.
 * @param {object} [options] - Compiler configuration options.
 * @param {boolean} [options.debug] - Enables debug logging.
 * @returns {object} Compiler API.
 */
export function createCompiler(options = {}) {
  const parser = new ComponentParser(new StyleProcessor(options.style || {}));
  const debug = options.debug ?? false;

  /**
   * Returns the generated class name from a component or page file.
   * @param {string} filePath Full path to the source file.
   * @returns {string} Generated class name.
   */
  function getClassName(filePath) {
    const base = path.basename(filePath);
    const cleaned = base
      .replace(/\.(component|page)\.(js|html|avx)$/i, '')
      .replace(/\.(js|html|avx)$/i, '');

    return cleaned
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  return {
    /**
     * Compiles an Avenx component.
     * @param {string} filePath Path to the component file.
     * @param {string} [code] Optional raw source code.
     * @returns {{code: string, map: object, className: string}}
     */
    compileComponent(filePath, code) {
      const originalCode = code ?? (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      const parsedCode = parser.parse(filePath);
      const className = getClassName(filePath);
      const wrappedCode = wrapComponent(parsedCode, className);
      const map = generateTemplateSourceMap(filePath, originalCode, wrappedCode);

      if (debug) {
        console.log('\n================ COMPILED COMPONENT ================\n');
        console.log(wrappedCode);
        console.log('\n====================================================\n');
      }

      return {
        code: wrappedCode,
        map,
        className,
      };
    },

    /**
     * Compiles an Avenx page.
     * @param {string} filePath Path to the page file.
     * @param {string} [code] Optional raw source code.
     * @returns {{code: string, map: object, className: string}}
     */
    compilePage(filePath, code) {
      const originalCode = code ?? (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      const parsedCode = parser.parse(filePath, 'page');
      const className = getClassName(filePath);
      const wrappedCode = wrapPage(parsedCode, className);
      const map = generateTemplateSourceMap(filePath, originalCode, wrappedCode);

      if (debug) {
        console.log('\n================ COMPILED PAGE =====================\n');
        console.log(wrappedCode);
        console.log('\n====================================================\n');
      }

      return {
        code: wrappedCode,
        map,
        className,
      };
    },
  };
}