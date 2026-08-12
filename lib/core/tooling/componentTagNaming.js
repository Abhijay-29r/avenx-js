import fs from 'fs';
import path from 'path';

const registryCache = new Map();

/**
 * Converts an Avenx component filename into its canonical PascalCase name.
 *
 * @param {string} fileName
 * @returns {string}
 */
export function componentNameFromFile(fileName) {
  return path
    .basename(fileName, '.component.js')
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Finds components registered by the Avenx compiler.
 *
 * Avenx registers components by scanning src/components for
 * .component.js files and normalizing their filenames.
 *
 * @param {string} projectRoot
 * @param {string} [componentsDir='src/components']
 * @returns {Set<string>}
 */
export function findRegisteredComponents(projectRoot, componentsDir = 'src/components') {
  const root = path.resolve(projectRoot);
  const directory = path.resolve(root, componentsDir);
  const cacheKey = directory;

  if (registryCache.has(cacheKey)) {
    return new Set(registryCache.get(cacheKey));
  }

  const names = new Set();

  const visit = (currentDir) => {
    if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
      return;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.component.js')) {
        names.add(componentNameFromFile(entry.name));
      }
    }
  };

  visit(directory);

  registryCache.set(cacheKey, new Set(names));
  return new Set(names);
}

/**
 * Resolves the configured Avenx components directory.
 *
 * @param {string} projectRoot
 * @param {string} [componentsDir]
 * @returns {string}
 */
export function resolveComponentsDir(projectRoot, componentsDir) {
  if (componentsDir) {
    return componentsDir;
  }

  const configPath = path.join(path.resolve(projectRoot), 'avenx.config.json');

  if (!fs.existsSync(configPath)) {
    return 'src/components';
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const srcDir =
      typeof config.srcDir === 'string' && config.srcDir.trim() !== ''
        ? config.srcDir.trim()
        : 'src';

    return path.join(srcDir, 'components');
  } catch {
    return 'src/components';
  }
}

/**
 * Masks text while preserving line positions.
 *
 * @param {string} value
 * @returns {string}
 */
function mask(value) {
  return value.replace(/[^\r\n]/g, ' ');
}

/**
 * Removes Avenx metadata blocks that are not part of the template.
 *
 * @param {string} source
 * @returns {string}
 */
export function extractLintableTemplate(source) {
  let template = source;

  const patterns = [
    /<!--[\s\S]*?-->/g,
    /<state\b[\s\S]*?\/>/gi,
    /<computed\b[\s\S]*?\/>/gi,
    /<action\b[\s\S]*?<\/action>/gi,
    /<resource\b[\s\S]*?<\/resource>/gi,
    /<resource\b[\s\S]*?\/>/gi,
  ];

  for (const pattern of patterns) {
    template = template.replace(pattern, mask);
  }

  return template;
}

/**
 * Finds registered component tags that are not written in PascalCase.
 *
 * @param {string} source
 * @param {Set<string>} registeredComponents
 * @returns {Array<{tagName: string, expectedName: string, index: number}>}
 */
export function findInvalidComponentTags(source, registeredComponents) {
  const template = extractLintableTemplate(source);
  const invalidTags = [];
  const tagRegex = /<([A-Za-z][A-Za-z0-9:_-]*)\b/g;

  let match;

  while ((match = tagRegex.exec(template)) !== null) {
    const tagName = match[1];

    if (registeredComponents.has(tagName)) {
      continue;
    }

    const comparableTag = tagName.replace(/[-_]/g, '').toLowerCase();

    const normalized = [...registeredComponents].find(
      (componentName) =>
        componentName.replace(/[-_]/g, '').toLowerCase() === comparableTag,
    );

    if (normalized && normalized !== tagName) {
      invalidTags.push({
        tagName,
        expectedName: normalized,
        index: match.index + 1,
      });
    }
  }

  return invalidTags;
}

/**
 * Finds the nearest package root.
 *
 * @param {string} filePath
 * @param {string} fallbackRoot
 * @returns {string}
 */
export function findProjectRoot(filePath, fallbackRoot) {
  let currentDir = path.dirname(path.resolve(filePath));
  const fallback = path.resolve(fallbackRoot);

  while (true) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    const parent = path.dirname(currentDir);
    const relativeToFallback = path.relative(fallback, parent);

    if (
      parent === currentDir ||
      relativeToFallback.startsWith('..') ||
      path.isAbsolute(relativeToFallback)
    ) {
      break;
    }

    currentDir = parent;
  }

  return fallback;
}