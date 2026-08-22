import fs from 'node:fs';
import path from 'node:path';
import StyleProcessor from '../../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../../lib/compiler/ComponentParser.js';
import { wrapComponent, wrapPage } from './wrapper.js';
import { generateTemplateSourceMap } from './sourcemap.js';
import { COMPONENT_CSS_EXT, PAGE_CSS_EXT } from './constants.js';

/**
 * Source extensions a stylesheet may belong to, in resolution order.
 * @type {string[]}
 */
const MODULE_EXTENSIONS = ['.js', '.html', '.avx'];

/**
 * Creates an Avenx compiler instance.
 * @param {object} [options] - Compiler configuration options.
 * @param {boolean} [options.debug] - Enables debug logging.
 * @returns {object} Compiler API.
 */
export function createCompiler(options = {}) {
  const debug = options.debug ?? false;

  /**
   * Builds a parser backed by a dedicated StyleProcessor.
   *
   * A StyleProcessor accumulates every scoped rule, source and generated line
   * it is given and is only reset by the CLI compiler's build(). Sharing one
   * instance across transforms would therefore grow for the lifetime of the dev
   * server and emit other components' rules into each module's stylesheet, so
   * each compile gets its own.
   * @returns {{parser: ComponentParser, styleProcessor: StyleProcessor}}
   */
  function createParser() {
    const styleProcessor = new StyleProcessor(options.style || {}, options.config || null);
    const parser = new ComponentParser(styleProcessor, options.voidTags || [], options.config || null);
    return { parser, styleProcessor };
  }

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

  /**
   * Resolves the co-located stylesheet for a component or page module.
   * @param {string} filePath - Path to the component or page module.
   * @returns {string|null} The stylesheet path, or null when there is none.
   */
  function findStyleSheet(filePath) {
    const isPage = /\.page\.(js|html|avx)$/i.test(filePath);
    const stylePath = filePath.replace(
      /\.(component|page)\.(js|html|avx)$/i,
      isPage ? PAGE_CSS_EXT : COMPONENT_CSS_EXT,
    );
    return stylePath !== filePath && fs.existsSync(stylePath) ? stylePath : null;
  }

  /**
   * Resolves the component or page module that owns a stylesheet.
   * @param {string} cssPath - Path to a .component.css or .page.css file.
   * @returns {string|null} The owning module path, or null when none exists.
   */
  function findOwningModule(cssPath) {
    const isPage = cssPath.endsWith(PAGE_CSS_EXT);
    const base = cssPath.slice(0, -(isPage ? PAGE_CSS_EXT.length : COMPONENT_CSS_EXT.length));
    const suffix = isPage ? '.page' : '.component';

    for (const ext of MODULE_EXTENSIONS) {
      const candidate = `${base}${suffix}${ext}`;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Compiles a component or page module and its scoped styles.
   * @param {string} filePath - Path to the source file.
   * @param {'component'|'page'} type - Compilation type.
   * @returns {{template: string, css: string, className: string, stylePath: string|null}}
   */
  function compileModule(filePath, type) {
    const { parser, styleProcessor } = createParser();
    const parsedCode = parser.parse(filePath, type);
    return {
      template: parsedCode,
      css: styleProcessor.getGlobalStyles(),
      className: getClassName(filePath),
      stylePath: findStyleSheet(filePath),
    };
  }

  return {
    /**
     * Compiles an Avenx component.
     * @param {string} filePath Path to the component file.
     * @param {string} [code] Optional raw source code.
     * @returns {{code: string, map: object, css: string, className: string}}
     */
    compileComponent(filePath, code) {
      const originalCode = code ?? (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      const { template, css, className, stylePath } = compileModule(filePath, 'component');
      const wrappedCode = wrapComponent(template, className, stylePath);
      const map = generateTemplateSourceMap(filePath, originalCode, wrappedCode);

      if (debug) {
        console.log('\n================ COMPILED COMPONENT ================\n');
        console.log(wrappedCode);
        console.log('\n====================================================\n');
      }

      return {
        code: wrappedCode,
        map,
        css,
        className,
      };
    },

    /**
     * Compiles an Avenx page.
     * @param {string} filePath Path to the page file.
     * @param {string} [code] Optional raw source code.
     * @returns {{code: string, map: object, css: string, className: string}}
     */
    compilePage(filePath, code) {
      const originalCode = code ?? (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      const { template, css, className, stylePath } = compileModule(filePath, 'page');
      const wrappedCode = wrapPage(template, className, stylePath);
      const map = generateTemplateSourceMap(filePath, originalCode, wrappedCode);

      if (debug) {
        console.log('\n================ COMPILED PAGE =====================\n');
        console.log(wrappedCode);
        console.log('\n====================================================\n');
      }

      return {
        code: wrappedCode,
        map,
        css,
        className,
      };
    },

    /**
     * Compiles a component or page stylesheet into its scoped CSS.
     *
     * Scoping depends on the owning module (the hash is derived from the block
     * contents and the component name, and the matching class is injected into
     * that module's template), so the owning module is compiled to produce it.
     * @param {string} cssPath - Path to the stylesheet.
     * @returns {string|null} The scoped CSS, or null when there is no owner.
     */
    compileStyle(cssPath) {
      const owner = findOwningModule(cssPath);
      if (!owner) {
        return null;
      }
      const type = cssPath.endsWith(PAGE_CSS_EXT) ? 'page' : 'component';
      const { css } = compileModule(owner, type);
      return css;
    },
  };
}
