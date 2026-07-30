/**
 * Pure environment-agnostic module for compiling route patterns and matching URLs.
 */
export class RouteMatcher {
  /**
   * Compiles a route pattern into a regular expression, tracking parameter names.
   * @param {string} routePattern - The route pattern (e.g. '/user/:id').
   * @returns {{regex: RegExp, paramNames: string[]}}
   */
  static compileRoute(routePattern) {
    const paramNames = [];
    const escaped = routePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    const regexStr = escaped.replace(/(:[a-zA-Z0-9_$]+)|(\*)/g, (_match, param) => {
      if (param) {
        paramNames.push(param.slice(1));
        return '([^/]+)';
      }
      paramNames.push('wildcard');
      return '(.*)';
    });

    return { regex: new RegExp(`^${regexStr}$`), paramNames };
  }

  /**
   * Normalizes a hash string with an optional namespace prefix.
   * @param {string} hash - Raw hash string (e.g. '#/app1/home').
   * @param {string} [prefix] - Namespace prefix (e.g. '/app1').
   * @returns {string|null} Normalized hash (e.g. '#/home'), or null if prefix does not match.
   */
  static normalizeHash(hash, prefix) {
    let normalized = hash || '#/';
    const secondHashIndex = normalized.indexOf('#', 1);
    if (secondHashIndex !== -1) {
      normalized = normalized.substring(0, secondHashIndex);
    }

    if (prefix) {
      const expectedStart = '#' + prefix;
      if (!normalized.startsWith(expectedStart)) {
        return null;
      }
      normalized = '#' + normalized.substring(expectedStart.length);
      if (!normalized.startsWith('#/')) {
        normalized = '#/' + normalized.substring(1);
      }
    }
    return normalized;
  }

  static _findMatch(routes, decodedPath, basePath = '', parentDef = null) {
    for (const [routePattern, routeDef] of Object.entries(routes)) {
      if (routePattern === '*') continue;

      let fullPattern = routePattern;
      if (basePath) {
        if (basePath.endsWith('/') && routePattern.startsWith('/')) {
          fullPattern = basePath + routePattern.slice(1);
        } else if (!basePath.endsWith('/') && !routePattern.startsWith('/')) {
          fullPattern = basePath + '/' + routePattern;
        } else {
          fullPattern = basePath + routePattern;
        }
      }

      const { regex, paramNames } = RouteMatcher.compileRoute(fullPattern);
      const match = decodedPath.match(regex);
      if (match) {
        return {
          pattern: fullPattern,
          definition: routeDef,
          parent: parentDef,
          match,
          paramNames
        };
      }

      if (routeDef && typeof routeDef === 'object' && routeDef.children) {
        let childRoutes = routeDef.children;
        if (Array.isArray(childRoutes)) {
          childRoutes = childRoutes.reduce((acc, child) => {
            acc[child.path] = child;
            return acc;
          }, {});
        }

        const nestedMatch = this._findMatch(childRoutes, decodedPath, fullPattern, {
          pattern: fullPattern,
          definition: routeDef
        });

        if (nestedMatch) return nestedMatch;
      }
    }
    return null;
  }

  /**
   * Checks if the route definitions have a non-fallback match for the given hash.
   * @param {Object<string, any>} routes - Map of route patterns.
   * @param {string} hash - The URL hash.
   * @param {object} [options] - Router options (e.g. prefix).
   * @returns {boolean} True if a non-fallback route matches.
   */
  static matches(routes, hash, options = {}) {
    const normalizedHash = RouteMatcher.normalizeHash(hash, options.prefix);
    if (normalizedHash === null) {
      return false;
    }

    const [pathPart] = normalizedHash.split('?');
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch {
      decodedPath = pathPart;
    }

    return !!this._findMatch(routes, decodedPath);
  }

  /**
   * Matches a hash string against a collection of routes.
   * @param {Object<string, any>} routes - Map of route patterns to definitions.
   * @param {string} hash - The URL hash.
   * @param {object} [options] - Router options (e.g. prefix).
   * @param {Iterable<object>} [activeRouters] - Active router instances to check for fallback wildcard resolution.
   * @param {object} [currentRouter] - The current router instance.
   * @returns {{matchedRoute: {pattern: string, definition: any, parent?: any}|null, params: object, otherRouterMatches: boolean, normalizedHash: string|null}}
   */
  static matchRoute(routes, hash, options = {}, activeRouters = [], currentRouter = null) {
    const normalizedHash = RouteMatcher.normalizeHash(hash, options.prefix);
    if (normalizedHash === null) {
      return { matchedRoute: null, params: {}, otherRouterMatches: false, normalizedHash: null };
    }

    let matchedRoute = null;
    const params = {};

    const [pathPart, queryPart] = normalizedHash.split('?');
    let decodedPath;

    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch {
      decodedPath = pathPart;
    }

    const found = this._findMatch(routes, decodedPath);
    if (found) {
      matchedRoute = { pattern: found.pattern, definition: found.definition };
      if (found.parent) {
        matchedRoute.parent = found.parent;
      }

      found.paramNames.forEach((name, idx) => {
        const value = found.match[idx + 1];
        try {
          params[name] = decodeURIComponent(value);
        } catch {
          params[name] = value;
        }
      });

      if (queryPart) {
        const queryParams = new URLSearchParams(queryPart);
        const parsedQuery = {};
        for (const [key, value] of queryParams.entries()) {
          if (value === 'true') {
            parsedQuery[key] = true;
          } else if (value === 'false') {
            parsedQuery[key] = false;
          } else if (/^\d+$/.test(value)) {
            parsedQuery[key] = Number(value);
          } else {
            parsedQuery[key] = value;
          }
        }
        params.query = parsedQuery;
      }
    }

    let otherRouterMatches = false;
    if (!matchedRoute && routes['*']) {
      const rawHash = hash || '#/';
      otherRouterMatches = Array.from(activeRouters || []).some(
        (r) => r !== currentRouter && typeof r.matches === 'function' && r.matches(rawHash),
      );

      if (!otherRouterMatches) {
        matchedRoute = { pattern: '*', definition: routes['*'] };
      }
    }

    return { matchedRoute, params, otherRouterMatches, normalizedHash };
  }
}
