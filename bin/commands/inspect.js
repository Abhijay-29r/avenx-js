import fs from 'fs';
import path from 'path';

/**
 * Converts a string to PascalCase.
 * @param {string} str
 * @returns {string}
 */
function toPascalCase(str) {
  if (!str) return '';
  return str
    .replace(/[-_.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Converts a PascalCase or camelCase string to kebab-case.
 * @param {string} str
 * @returns {string}
 */
function toKebabCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Recursively gets all files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extracts route mappings from project JS files (such as main.app.js).
 * @param {string} srcDir
 * @returns {Map<string, string>}
 */
function extractRoutesMap(srcDir) {
  const routesMap = new Map();
  const files = getAllFiles(srcDir).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Look for initRouter({ ... })
    const initRouterMatches = content.matchAll(/initRouter\s*\(\s*\{([\s\S]*?)\}\s*[),]/g);
    for (const match of initRouterMatches) {
      const body = match[1];
      const pairRegex = /['"]([^'"]+)['"]\s*:\s*['"]?([A-Za-z0-9_$]+)['"]?/g;
      let pairMatch;
      while ((pairMatch = pairRegex.exec(body)) !== null) {
        let routePath = pairMatch[1].trim();
        const targetName = pairMatch[2].trim();

        if (routePath.startsWith('#/')) {
          routePath = routePath.slice(1);
        }
        if (routePath === '' || routePath === '#') {
          routePath = '/';
        }

        if (!routesMap.has(targetName) || (routesMap.get(targetName) === '/' && routePath !== '/')) {
          routesMap.set(targetName, routePath);
        }
      }
    }

    // Look for <state route="..." /> or <state path="..." />
    const stateRouteMatch = content.match(/<state\s+[^>]*?(?:route|path)=['"]([^'"]+)['"]/);
    if (stateRouteMatch) {
      const routePath = stateRouteMatch[1];
      const classMatch = content.match(/class\s+([A-Za-z0-9_$]+)/);
      if (classMatch) {
        routesMap.set(classMatch[1], routePath);
      }
    }
  }

  return routesMap;
}

/**
 * Checks whether a component is referenced in templates or application code.
 * @param {string} compName
 * @param {string} compFile
 * @param {string} srcDir
 * @param {string} rootDir
 * @returns {boolean}
 */
function isComponentUsed(compName, compFile, srcDir, rootDir) {
  const kebabName = toKebabCase(compName);
  const compDir = path.dirname(compFile);

  const files = getAllFiles(srcDir);
  const indexHtml = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    files.push(indexHtml);
  }

  for (const file of files) {
    if (file.startsWith(compDir)) continue;
    if (!file.endsWith('.js') && !file.endsWith('.html') && !file.endsWith('.ts')) continue;

    const rawContent = fs.readFileSync(file, 'utf-8');
    const content = rawContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

    // Check template tag references
    const tagRegex = new RegExp(`<(${compName}|${kebabName})\\b`, 'i');
    if (tagRegex.test(content)) {
      return true;
    }

    // Check app.mount('CompName')
    if (content.includes(`app.mount('${compName}')`) || content.includes(`app.mount("${compName}")`)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses and returns the page, component, and bridge declarations in the project.
 * @param {object} cli
 */
export function runInspect(cli) {
  const srcRel = cli.config.srcDir || 'src';
  const rootDir = cli.baseDir;
  const srcDir = path.join(rootDir, srcRel);

  const allFiles = getAllFiles(srcDir);
  const routesMap = extractRoutesMap(srcDir);

  const pages = [];
  const components = [];
  const bridges = [];

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file).split(path.sep).join('/');
    const filename = path.basename(file);
    if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const classMatch = content.match(/(?:export\s+(?:default\s+)?)?class\s+([A-Za-z0-9_$]+)/);

    const isPage = file.includes(`${path.sep}pages${path.sep}`) || filename.endsWith('.page.js');
    const isBridge =
      file.includes(`${path.sep}bridges${path.sep}`) ||
      file.includes(`${path.sep}global${path.sep}`) ||
      filename.endsWith('.bridge.js');
    const isComponent =
      !isPage && !isBridge && (file.includes(`${path.sep}components${path.sep}`) || filename.endsWith('.component.js'));

    if (isPage) {
      let pageName = classMatch ? classMatch[1] : '';
      if (!pageName) {
        const base = filename.replace(/\.page\.js$/, '').replace(/\.js$/, '');
        pageName = toPascalCase(base);
        if (!pageName.endsWith('Page') && routesMap.has(pageName + 'Page')) {
          pageName += 'Page';
        }
      }
      let route = routesMap.get(pageName);
      if (!route) {
        // Try without 'Page' suffix or base name
        const base = filename.replace(/\.page\.js$/, '').replace(/\.js$/, '');
        const altName = toPascalCase(base);
        route = routesMap.get(altName);
      }
      pages.push({ name: pageName, route: route || null, relPath });
    } else if (isComponent) {
      let compName = classMatch ? classMatch[1] : '';
      if (!compName) {
        const base = filename.replace(/\.component\.js$/, '').replace(/\.js$/, '');
        compName = toPascalCase(base);
      }
      const used = isComponentUsed(compName, file, srcDir, rootDir);
      components.push({ name: compName, isUnused: !used, relPath });
    } else if (isBridge) {
      let bridgeName = classMatch ? classMatch[1] : '';
      if (!bridgeName) {
        const base = filename.replace(/\.bridge\.js$/, '').replace(/\.js$/, '');
        bridgeName = toPascalCase(base);
        if (!bridgeName.endsWith('Bridge')) {
          bridgeName += 'Bridge';
        }
      }
      bridges.push({ name: bridgeName, relPath });
    }
  }

  // Sort deterministically by relative path
  pages.sort((a, b) => a.relPath.localeCompare(b.relPath));
  components.sort((a, b) => a.relPath.localeCompare(b.relPath));
  bridges.sort((a, b) => a.relPath.localeCompare(b.relPath));

  console.log(`📦 Avenx Project Hierarchy (${srcRel}/)`);

  const categories = [
    {
      title: `📄 Pages (${pages.length})`,
      items: pages.map((p) => {
        const routeStr = p.route ? ` (${p.route})` : '';
        return `${p.name}${routeStr} -> ${p.relPath}`;
      }),
    },
    {
      title: `🧩 Components (${components.length})`,
      items: components.map((c) => {
        const unusedStr = c.isUnused ? ' (⚠️ Unused)' : '';
        return `${c.name} -> ${c.relPath}${unusedStr}`;
      }),
    },
    {
      title: `🌉 Bridges (${bridges.length})`,
      items: bridges.map((b) => `${b.name} -> ${b.relPath}`),
    },
  ];

  for (let cIdx = 0; cIdx < categories.length; cIdx++) {
    const category = categories[cIdx];
    const isLastCategory = cIdx === categories.length - 1;
    const catPrefix = isLastCategory ? '└── ' : '├── ';
    const childIndent = isLastCategory ? '    ' : '│   ';

    console.log(`${catPrefix}${category.title}`);

    for (let iIdx = 0; iIdx < category.items.length; iIdx++) {
      const item = category.items[iIdx];
      const isLastItem = iIdx === category.items.length - 1;
      const itemPrefix = isLastItem ? '└── ' : '├── ';
      console.log(`${childIndent}${itemPrefix}${item}`);
    }
  }
}
