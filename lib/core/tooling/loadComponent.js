/**
 * @file loadComponent.js
 * @description Compiles a single Avenx component file into a usable class.
 *
 * Avenx component files are not JavaScript modules. A `.component.js` holds
 * `<state>`, `<action>` and template markup, and only means anything after the
 * compiler has turned it into a class. So a test cannot `import` one — which
 * is a problem for generated regression tests, whose whole purpose is to mount
 * the component a trace was recorded against.
 *
 * This runs the same `ComponentParser` the build uses on one file and
 * evaluates the class it emits. Because it is the real compiler, a generated
 * test exercises the same code the application ships, not a hand-written
 * approximation of it.
 *
 * Lives under `tooling/` rather than `testing/` because it reads from disk:
 * the house rule is that `fs` and `path` stay out of anything the browser
 * runtime can reach.
 * @module lib/core/tooling/loadComponent
 */

import fs from 'fs';
import path from 'path';
import ComponentParser from '../../compiler/ComponentParser.js';
import StyleProcessor from '../../compiler/StyleProcessor.js';
import { AvenxComponent } from '../runtime/AvenxComponent.js';
import { AvenxPage } from '../runtime/AvenxPage.js';

/**
 * Derives the class name the compiler will emit for a component file.
 * @param {string} filePath - Path to the component or page file.
 * @returns {string} The PascalCase class name.
 */
export function classNameFor(filePath) {
  return path
    .basename(filePath)
    .replace(/\.(component|page)?\.(js|html|avx)$/i, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Compiles a component or page file and returns the class.
 * @param {string} filePath - Absolute or cwd-relative path to the file.
 * @param {object} [options] - Compilation options.
 * @param {'component'|'page'} [options.type] - Inferred from the filename when omitted.
 * @param {object} [options.config] - Project configuration to compile with.
 * @returns {Function} The compiled component or page class.
 * @throws {Error} When the file does not exist or does not compile to a class.
 */
export function loadComponent(filePath, options = {}) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Cannot load component: ${resolved} does not exist.`);
  }

  const type = options.type || (/\.page\.js$/i.test(resolved) ? 'page' : 'component');
  const parser = new ComponentParser(new StyleProcessor({}, options.config || {}), [], options.config || null);
  const source = parser.parse(resolved, type);
  const className = classNameFor(resolved);

  // The compiler emits `class X extends AvenxComponent { ... }` as a bare
  // declaration, which is exactly what a bundle concatenates. Evaluating it
  // with the base classes in scope is the same thing the bundle does, and
  // keeps this helper from having to understand the generated shape.
  const factory = new Function(
    'AvenxComponent',
    'AvenxPage',
    `${source}\nreturn ${className};`,
  );

  const ComponentClass = factory(AvenxComponent, AvenxPage);
  if (typeof ComponentClass !== 'function') {
    throw new Error(`Compiling ${resolved} did not produce a class called ${className}.`);
  }
  return ComponentClass;
}
