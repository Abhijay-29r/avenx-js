import fs from 'node:fs';

/**
 * Loads an Avenx stylesheet as the scoped CSS the runtime expects.
 *
 * Avenx stylesheets are not plain CSS: rules live in `<@css>` blocks keyed by
 * block name, and the compiler rewrites those names into hashed scope classes
 * that it also injects into the component's template. Returning the block
 * bodies verbatim produced selectors like `box { ... }`, which match nothing,
 * so component styles silently did not apply under Vite while the same source
 * worked under `avenx build`.
 * @param {string} filePath - Absolute path to the stylesheet.
 * @param {object} [compiler] - Compiler instance from createCompiler().
 * @returns {string|null} The scoped CSS, or null when the file does not exist.
 */
export function loadStyle(filePath, compiler) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  if (compiler && typeof compiler.compileStyle === 'function') {
    const scoped = compiler.compileStyle(filePath);
    if (typeof scoped === 'string') {
      return scoped;
    }
  }

  // No owning component or page could be resolved, so there is no scope to
  // apply. Fall back to the raw declarations with the block markers removed.
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/<@css>/g, '')
    .replace(/<\/@css>/g, '')
    .trim();
}
