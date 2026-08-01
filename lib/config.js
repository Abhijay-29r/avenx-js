import fs from 'fs';
import path from 'path';
import { logger } from './core/runtime/AvenxLogger.js';
import { setDebugReactivity } from './core/reactive/watcher.js';

/**
 * Find the project root directory by scanning upwards from startDir.
 * Looks for package.json or index.html.
 * @param {string} startDir
 * @returns {string}
 */
function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const indexHtmlPath = path.join(currentDir, 'index.html');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg && pkg.name !== 'avenx-core') {
          return currentDir;
        }
      } catch {
        return currentDir;
      }
    } else if (fs.existsSync(indexHtmlPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return startDir;
}

/**
 * Computes the Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp.push([i]);
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Returns the closest match from allowedKeys based on Levenshtein distance,
 * if it is within a threshold.
 * @param {string} key
 * @param {string[]} allowedKeys
 * @returns {string|null}
 */
function getClosestKey(key, allowedKeys) {
  let closest = null;
  let minDistance = Infinity;
  for (const allowed of allowedKeys) {
    const dist = levenshtein(key.toLowerCase(), allowed.toLowerCase());
    if (dist < minDistance) {
      minDistance = dist;
      closest = allowed;
    }
  }
  if (minDistance <= 3) {
    return closest;
  }
  return null;
}

/**
 * Load the Avenx configuration from avenx.config.json file.
 * @param {string} [baseDir] - The base directory of the project.
 */
function loadConfig(baseDir) {
  const defaults = {
    srcDir: 'src',
    distDir: 'dist',
    templatesDir: '.avenxtemplates',
    server: {
      port: 3000,
      host: 'localhost',
      liveReload: true,
    },
    style: {
      preprocessor: 'none',
    },
    debug: {
      debugReactivity: false,
    },
    voidTags: [],
    warnings: {},
    preprocessors: {},
  };

  const rootDir = baseDir || findProjectRoot(process.cwd());
  const configPath = path.join(rootDir, 'avenx.config.json');

  if (!fs.existsSync(configPath)) {
    setDebugReactivity(defaults.debug.debugReactivity);
    return defaults;
  }

  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (userConfig && typeof userConfig === 'object' && !Array.isArray(userConfig)) {
      const allowedTopLevel = [
        'srcDir',
        'distDir',
        'templatesDir',
        'server',
        'style',
        'debug',
        'outputName',
        'logging',
        'voidTags',
        'warnings',
        'treeShakeComponents',
        'preprocessors',
      ];
      for (const key of Object.keys(userConfig)) {
        if (!allowedTopLevel.includes(key)) {
          const closest = getClosestKey(key, allowedTopLevel);
          const suggestion = closest ? `. Did you mean "${closest}"?` : '.';
          logger.warn(`Unknown configuration option "${key}" in avenx.config.json${suggestion} Supported top-level options are: ${allowedTopLevel.join(', ')}.`);
        } else {
          if (key === 'server' && userConfig.server && typeof userConfig.server === 'object' && !Array.isArray(userConfig.server)) {
            const allowedServerKeys = ['port', 'host', 'liveReload'];
            for (const subKey of Object.keys(userConfig.server)) {
              if (!allowedServerKeys.includes(subKey)) {
                const closest = getClosestKey(subKey, allowedServerKeys);
                const suggestion = closest ? `. Did you mean "server.${closest}"?` : '.';
                logger.warn(`Unknown configuration option "server.${subKey}" in avenx.config.json${suggestion} Supported options for "server" are: ${allowedServerKeys.join(', ')}.`);
              }
            }
          }
          if (key === 'style' && userConfig.style && typeof userConfig.style === 'object' && !Array.isArray(userConfig.style)) {
            const allowedStyleKeys = ['preprocessor', 'sourceMap', 'inlineSourceMap', 'dev'];
            for (const subKey of Object.keys(userConfig.style)) {
              if (!allowedStyleKeys.includes(subKey)) {
                const closest = getClosestKey(subKey, allowedStyleKeys);
                const suggestion = closest ? `. Did you mean "style.${closest}"?` : '.';
                logger.warn(`Unknown configuration option "style.${subKey}" in avenx.config.json${suggestion} Supported options for "style" are: ${allowedStyleKeys.join(', ')}.`);
              }
            }
          }
          if (key === 'debug' && userConfig.debug && typeof userConfig.debug === 'object' && !Array.isArray(userConfig.debug)) {
            const allowedDebugKeys = ['debugReactivity'];
            for (const subKey of Object.keys(userConfig.debug)) {
              if (!allowedDebugKeys.includes(subKey)) {
                const closest = getClosestKey(subKey, allowedDebugKeys);
                const suggestion = closest ? `. Did you mean "debug.${closest}"?` : '.';
                logger.warn(`Unknown configuration option "debug.${subKey}" in avenx.config.json${suggestion} Supported options for "debug" are: ${allowedDebugKeys.join(', ')}.`);
              }
            }
          }
          if (key === 'logging' && userConfig.logging && typeof userConfig.logging === 'object' && !Array.isArray(userConfig.logging)) {
            const allowedLoggingKeys = ['level', 'silent'];
            for (const subKey of Object.keys(userConfig.logging)) {
              if (!allowedLoggingKeys.includes(subKey)) {
                const closest = getClosestKey(subKey, allowedLoggingKeys);
                const suggestion = closest ? `. Did you mean "logging.${closest}"?` : '.';
                logger.warn(`Unknown configuration option "logging.${subKey}" in avenx.config.json${suggestion} Supported options for "logging" are: ${allowedLoggingKeys.join(', ')}.`);
              }
            }
          }
        }
      }
    }

    if (userConfig.warnings !== undefined) {
      if (typeof userConfig.warnings !== 'object' || userConfig.warnings === null || Array.isArray(userConfig.warnings)) {
        throw new Error('warnings must be an object');
      }
    }

    if (userConfig.preprocessors !== undefined) {
      if (
        (typeof userConfig.preprocessors !== 'object' || userConfig.preprocessors === null || Array.isArray(userConfig.preprocessors)) &&
        typeof userConfig.preprocessors !== 'function'
      ) {
        throw new Error('preprocessors must be an object or function');
      }
    }

    let preprocessors = defaults.preprocessors;
    if (typeof userConfig.preprocessors === 'function') {
      preprocessors = userConfig.preprocessors;
    } else if (userConfig.preprocessors) {
      preprocessors = { ...defaults.preprocessors, ...userConfig.preprocessors };
    }

    const config = {
      ...defaults,
      ...userConfig,
      server: {
        ...defaults.server,
        ...(userConfig.server || {}),
      },
      style: {
        ...defaults.style,
        ...(userConfig.style || {}),
      },
      debug: {
        ...defaults.debug,
        ...(userConfig.debug || {}),
      },
      warnings: {
        ...defaults.warnings,
        ...(userConfig.warnings || {}),
      },
      preprocessors,
    };

    if (typeof config.debug.debugReactivity !== 'boolean') {
      throw new Error('debug.debugReactivity must be a boolean');
    }

    setDebugReactivity(config.debug.debugReactivity);

    if (typeof config.srcDir !== 'string' || config.srcDir.trim() === '') {
      throw new Error('srcDir must be a non-empty string');
    }
    if (path.isAbsolute(config.srcDir)) {
      throw new Error('srcDir must be a relative path');
    }

    if (typeof config.distDir !== 'string' || config.distDir.trim() === '') {
      throw new Error('distDir must be a non-empty string');
    }
    if (path.isAbsolute(config.distDir)) {
      throw new Error('distDir must be a relative path');
    }

    if (typeof config.templatesDir !== 'string' || config.templatesDir.trim() === '') {
      throw new Error('templatesDir must be a non-empty string');
    }
    if (path.isAbsolute(config.templatesDir)) {
      throw new Error('templatesDir must be a relative path');
    }

    if (!Array.isArray(config.voidTags) || config.voidTags.some((tag) => typeof tag !== 'string' || tag.trim() === '')) {
      throw new Error('voidTags must be an array of non-empty strings');
    }

    const allowedSeverities = ['off', 'ignore', 'warn', 'warning', 'error'];
    for (const [code, severity] of Object.entries(config.warnings)) {
      if (typeof severity !== 'string') {
        throw new Error(`warnings.${code} must be a string severity ("off", "ignore", "warn", "warning", "error")`);
      }
      const normSeverity = severity.trim().toLowerCase();
      if (!allowedSeverities.includes(normSeverity)) {
        throw new Error(`Invalid severity "${severity}" for warning "${code}". Allowed values: "off", "ignore", "warn", "warning", "error"`);
      }
    }

    if (typeof config.server.port !== 'number' || config.server.port < 0 || config.server.port > 65535) {
      throw new Error('server.port must be a valid port number (0-65535)');
    }

    if (typeof config.server.host !== 'string' || config.server.host.trim() === '') {
      throw new Error('server.host must be a non-empty string');
    }

    if (typeof config.server.liveReload !== 'boolean') {
      throw new Error('server.liveReload must be a boolean');
    }

    return config;
  } catch (err) {
    logger.error(`Invalid avenx.config.json: ${err.message}`);
    if (process.env.NODE_ENV === 'test') {
      throw err;
    }
    process.exit(1);
  }
}

loadConfig.findProjectRoot = findProjectRoot;

export default loadConfig;
