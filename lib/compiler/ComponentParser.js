import fs from 'fs';
import path from 'path';
import ExpressionParser, { readDeclarations } from './expressionParser.js';
import { analyzeBridgeFile, findBridgeImports } from './BridgeParser.js';
import ContractValidator from './ContractValidator.js';
import { logger } from '../core/runtime/AvenxLogger.js';
import { AvenxErrorCodes } from '../core/runtime/AvenxError.js';
import { RESERVED_INSTANCE_METHOD_KEYS } from '../core/runtime/AvenxComponent.js';
import { TemplateValidationError, BuildError } from './errors/index.js';
import { reportWarning } from './utils/warningReporter.js';
import { replaceEnvVariables } from '../env.js';
import { processBindDirectives, escapeTemplateMarkers } from '../core/utils/templateUtils.js';
import { tokenizeMarkup, applyEdits } from '../core/utils/markupLexer.js';
import { isEventHandlerAttribute } from '../core/security/eventAttributes.js';
import loadConfig, { resolvePathAlias, getClosestKey } from '../config.js';
import { collectLocations } from './sourceMapTrace.js';
import { addCachedComponentUnit } from './atlas/cache.js';
import {
  createUnitKey,
  getCachedUnit,
  setCachedUnit,
} from './incrementalCache.js';
import { collectTemplateEvents } from './templateEvents.js';
import { interpolationEnd } from '../core/utils/markupLexer.js';
import { getLineAndColumn, parseAttributes, parseHTML, scanTagEnd, serializeHTML } from './parser/htmlTree.js';
import { buildTemplateIR, parseForHeader } from './ir/build.js';
import { lowerToProgram } from './ir/lower.js';
import { validateComponentExpressions } from './validateExpressions.js';
import { collectImportStatements } from './modules.js';

/**
 * The executable source of each declared resource, keyed by name.
 *
 * A resource is emitted either as a bare handler string or as
 * `{ handler, pollInterval }`, and the runtime prefixes a bare expression with
 * `return`. Both shapes are normalised here so the generator sees exactly the
 * text the runtime will execute -- otherwise a polling resource would compile
 * against a string that is not what runs, and quietly miss.
 * @param {object} resources - The parsed resource declarations.
 * @returns {Object<string, string>} Handler sources by resource name.
 */
function resourceBodies(resources) {
  const bodies = {};
  for (const [name, definition] of Object.entries(resources || {})) {
    const handler = definition && typeof definition === 'object' ? definition.handler : definition;
    if (typeof handler !== 'string' || handler.trim() === '') continue;
    bodies[name] = handler.trim().startsWith('return') ? handler : `return ${handler}`;
  }
  return bodies;
}
import { collectExpressions } from './codegen/collect.js';
import { buildExpressionTable, buildProgramTables } from './codegen/table.js';



/**
 * Framework tags the compiler understands directly. These are never real
 * components, so a reference to one must not be reported as an unresolved
 * component (see {@link ComponentParser#validateComponentTags} / AVX_W46).
 *
 * The `@`-prefixed directives (`@for`, `@if`, `@suspense`, …) are handled
 * separately: any tag beginning with `@` is skipped unconditionally, so it is
 * enough to list the non-prefixed framework tags here.
 * @type {Set<string>}
 */
const BUILTIN_TAGS = new Set([
  'slot',
  'resource',
  'state',
  'action',
  'transition',
  'template',
  'component',
  'script',
  'style',
]);



/**
 * The parameter names bound by arrow functions in an expression.
 *
 * Covers `x => …` and `(x, y) => …`, which is the whole of what the template
 * expression language admits -- a destructuring parameter is not an expression
 * and is refused before it reaches here.
 * @param {string} code - The expression source.
 * @returns {Set<string>} The bound names.
 */
function arrowParameters(code) {
  const names = new Set();
  const arrow = /(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/g;
  let match;

  while ((match = arrow.exec(code)) !== null) {
    const list = match[1] !== undefined ? match[1] : match[2];
    for (const part of list.split(',')) {
      const name = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

/**
 * Adds every name a `<@for>` header binds to the declared set.
 *
 * `index` is included for every loop, named or not, because that is how the
 * loop index has always been reached -- and reporting it as undeclared was a
 * warning on correct code, which is worse than no warning at all.
 * @param {object} node - A parsed template node.
 * @param {Set<string>} declared - The set to add to.
 */
function collectLoopBindings(node, declared) {
  if (!node || node.type !== 'element') return;

  if ((node.tagName || '').toLowerCase() === '@for') {
    declared.add('index');
    try {
      const parts = parseForHeader(node.rawAttrs);
      if (parts.item) declared.add(parts.item);
      for (const name of parts.destructure || []) declared.add(name);
    } catch {
      // A malformed header is reported by the IR builder, with a location and
      // a reason. Adding a second, vaguer complaint here would not help.
    }
  }

  for (const child of node.children || []) {
    collectLoopBindings(child, declared);
  }
}

/**
 * A conservative set of known HTML and SVG element names. Element names are
 * lowercase, so a PascalCase tag can practically never collide with one; this
 * set exists only as a defensive net for an element written with an unusual
 * case. It is deliberately not exhaustive — anything lowercase is treated as an
 * ordinary element regardless of membership (see {@link ComponentParser#validateComponentTags}).
 * @type {Set<string>}
 */
const KNOWN_ELEMENTS = new Set([
  // Common HTML
  'a', 'abbr', 'address', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo',
  'blockquote', 'body', 'button', 'canvas', 'caption', 'cite', 'code',
  'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog',
  'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption', 'figure', 'footer',
  'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup',
  'html', 'i', 'iframe', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'map',
  'mark', 'menu', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup',
  'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'select', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'tr', 'u', 'ul', 'var', 'video',
  // SVG
  'svg', 'circle', 'clippath', 'defs', 'ellipse', 'foreignobject', 'g',
  'image', 'line', 'lineargradient', 'marker', 'mask', 'path', 'pattern',
  'polygon', 'polyline', 'radialgradient', 'rect', 'stop', 'symbol', 'text',
  'tspan', 'use',
]);

/**
 * The local names a component's own imports bind, excluding bridges and the
 * runtime entry.
 *
 * A bridge already reaches the template through the bridges argument, and the
 * runtime import binds the base class the generated module extends. Everything
 * else -- an npm package, a local helper -- is a value the developer expects to
 * be able to name, so it becomes part of the component's evaluation scope.
 * @param {string} source - The component source.
 * @param {string[]} bridgeLocals - Local names already bound as bridges.
 * @returns {string[]} Local binding names, in source order.
 */
function collectImportBindings(source, bridgeLocals) {
  const bridges = new Set(bridgeLocals);
  const names = [];

  for (const statement of collectImportStatements(source)) {
    const match = statement.match(/^import\s+([\s\S]*?)\s+from\s*['"]([^'"]*)['"]/);
    if (!match) continue;
    if (/^(avenx-core(\/(runtime|core))?)$/.test(match[2])) continue;

    const clause = match[1].trim();
    const braceStart = clause.indexOf('{');
    const head = (braceStart === -1 ? clause : clause.slice(0, braceStart)).replace(/,\s*$/, '').trim();

    const star = head.match(/^(?:([A-Za-z_$][\w$]*)\s*,\s*)?\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (star) {
      if (star[1]) names.push(star[1]);
      names.push(star[2]);
    } else if (/^[A-Za-z_$][\w$]*$/.test(head)) {
      names.push(head);
    }

    if (braceStart !== -1) {
      const close = clause.indexOf('}', braceStart);
      const inner = close === -1 ? clause.slice(braceStart + 1) : clause.slice(braceStart + 1, close);
      for (const part of inner.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const aliased = trimmed.split(/\s+as\s+/);
        const local = (aliased[1] || aliased[0]).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(local)) names.push(local);
      }
    }
  }

  return names.filter((name) => !bridges.has(name) && !names.includes(name, names.indexOf(name) + 1));
}

/**
 * Cache of resolved `avenx.config.json` contents, keyed by the directory
 * the search started from, so each component file doesn't re-read and
 * re-parse the config from disk.
 * @type {Map<string, object|null>}
 */
const configCache = new Map();

/**
 * Walks up the directory tree from `startDir` looking for an
 * `avenx.config.json` file, and returns its parsed contents (or `null` if
 * none is found, or if it fails to parse).
 * @param {string} startDir - Absolute directory to start searching from.
 * @returns {object|null}
 */
function loadAvenxConfig(startDir) {
  if (configCache.has(startDir)) {
    return configCache.get(startDir);
  }

  let config = null;
  let currentDir = startDir;
  while (currentDir) {
    const configPath = path.join(currentDir, 'avenx.config.json');
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (err) {
        reportWarning(AvenxErrorCodes.COMPILER_INVALID_CONFIG, new BuildError(AvenxErrorCodes.COMPILER_INVALID_CONFIG, configPath, err.message));
        config = null;
      }
      break;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  configCache.set(startDir, config);
  return config;
}

/**
 * Resolves the list of project-specific void tags declared in
 * `avenx.config.json` (via a `voidTags` array) for the given component
 * file, e.g.:
 * ```json
 * { "voidTags": ["my-video", "my-icon"] }
 * ```
 * @param {string} [filePath] - Absolute path of the component file being compiled.
 * @returns {string[]} Lowercased, trimmed custom void tag names. Empty if none configured.
 */
function getCustomVoidTags(filePath) {
  if (!filePath) {
    return [];
  }
  const startDir = path.resolve(path.dirname(filePath));
  const config = loadAvenxConfig(startDir);
  if (!config || !Array.isArray(config.voidTags)) {
    return [];
  }
  return config.voidTags
    .filter((tag) => typeof tag === 'string' && tag.trim() !== '')
    .map((tag) => tag.trim().toLowerCase());
}



/**
 * Builds the atomic descriptor the generated constructor carries.
 *
 * Only the runtime-relevant half of a modifier reaches the bundle. The write
 * set, the boundedness flag and the irreversible-effect list are compile-time
 * findings: they exist to be reported before the application ships, and the
 * journal does not need them because it observes the reactive proxies rather
 * than a prediction of what they will do.
 *
 * A modifier naming an action the component does not declare is dropped. The
 * generated code would otherwise reference a method that is not there, and a
 * typo in `name=` is already reported by the action itself being missing.
 * @param {Object<string, {atomic: boolean, onConflict: string=}>} modifiers - Parsed modifiers.
 * @param {Object<string, string>} methods - The component's action bodies.
 * @returns {Object<string, object>|null} The descriptor, or null when there is nothing to emit.
 */
function buildAtomicSpec(modifiers, methods) {
  if (!modifiers) return null;
  /** @type {Object<string, object>} */
  const spec = {};
  let found = false;
  for (const name of Object.keys(modifiers).sort()) {
    if (!Object.prototype.hasOwnProperty.call(methods || {}, name)) continue;
    const modifier = modifiers[name];
    if (!modifier || !modifier.atomic) continue;
    spec[name] = modifier.onConflict ? { onConflict: modifier.onConflict } : {};
    found = true;
  }
  return found ? spec : null;
}

/**
 * The component class name a file compiles to: `user-profile.component.js`
 * becomes `UserProfile`.
 * @param {string} filePath - The component or page path.
 * @returns {string} The class name.
 */
function classNameFromPath(filePath) {
  return path
    .basename(filePath)
    .replace(/\.(component|page)?\.(js|html|avx)$/i, '')
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Removes HTML comments from a template by lexer span.
 *
 * Only real comments are removed. `title="<!-- x -->"` is an attribute value,
 * and an unterminated `<!--` is left for {@link ComponentParser#assertWellFormedTemplate}
 * to report rather than silently deleting the rest of the template.
 * @param {string} template - The template.
 * @returns {string} The template without comments.
 */
function stripTemplateComments(template) {
  if (typeof template !== 'string' || !template.includes('<!--')) return template;
  const edits = tokenizeMarkup(template)
    .filter((token) => token.type === 'comment' && !token.unterminated)
    .map((token) => ({ start: token.start, end: token.end, text: '' }));
  return applyEdits(template, edits);
}

/**
 * ComponentParser handles the parsing of Avenx component files (.js and .css).
 * It extracts component state, computed properties, methods, and templates,
 * and coordinates with the StyleProcessor to handle styles.
 */
class ComponentParser {

  /**
   * Fails the build when a refused template uses a compiled-only construct.
   *
   * Falling back is safe for a construct both renderers implement: the template
   * renders, more slowly, and the build says so. `<@if>` is not such a
   * construct. It only ever existed on the compiled path, so the string
   * renderer has no rewrite for it -- a refused template containing one would
   * render `<@if cond>` into the document as a literal element, wrapping the
   * branch it was supposed to choose between.
   *
   * That is exactly the silent miscompile the compile-or-refuse rule exists to
   * prevent, so it is an error with a location rather than a warning. The fix
   * is always the same: get the template compiling, by moving the construct
   * that refused into a child component.
   * @param {string} name - The component class name.
   * @param {string} filePath - The component's path.
   * @param {string} template - The semantic template.
   * @param {{reason: string, detail: string}} refusal - Why it refused.
   * @throws {TemplateValidationError} When the template cannot fall back safely.
   */
  assertNoCompiledOnlyConstruct(name, filePath, template, refusal) {
    const match = template.match(/<@(if|elseif|elif|else)\b/i);
    if (!match) return;

    const error = new TemplateValidationError(
      AvenxErrorCodes.COMPILER_COMPILED_ONLY_CONSTRUCT,
      name,
      match[1],
      `${refusal.reason} (${refusal.detail})`,
    );
    error.setLocation({ source: template, index: match.index, filePath });
    throw error;
  }

  /**
   * Compiles this component's template to a render program.
   *
   * Runs on {@link ComponentParser#lastSemanticTemplate} -- the template after
   * styles and two-way bindings and before any directive rewrite -- so the IR
   * reads `<@for>` and `<@if>` as the constructs they are rather than as the
   * markup they used to be turned into.
   *
   * Either half may refuse. The IR refuses a construct it does not model yet;
   * the lowering refuses an IR node it cannot emit. Either way the component
   * keeps the string renderer and the reason is recorded for the build to
   * report, which is the same compile-or-refuse rule that has always applied.
   * @param {string} name - The component class name.
   * @param {string} filePath - The component's path, for diagnostics.
   * @param {string[]} voidTags - The effective void tag set.
   * @returns {{program: object|null, expressions: string[], statements: string[]}}
   *   The program and the sources its indices address.
   */
  compileRenderProgram(name, filePath, voidTags) {
    const source = this.lastSemanticTemplate;
    if (typeof source !== 'string' || source.trim() === '') {
      return { program: null, expressions: [], statements: [] };
    }

    // Static marking runs on the semantic template rather than on the rewritten
    // one, because the IR is built from the semantic template and a mark
    // applied after it would never be seen.
    const marked = this.optimizeStaticSubtrees(source, filePath);

    const built = buildTemplateIR(marked, { voidTags });
    if (built.refusal) {
      this.assertNoCompiledOnlyConstruct(name, filePath, source, built.refusal);
      this.renderFallbacks.push({ name, reason: built.refusal.reason, detail: built.refusal.detail });
      return { program: null, expressions: [], statements: [] };
    }

    const lowered = lowerToProgram(built.ir, { voidTags });
    if (lowered.refusal) {
      this.assertNoCompiledOnlyConstruct(name, filePath, source, lowered.refusal);
      this.renderFallbacks.push({ name, reason: lowered.refusal.reason, detail: lowered.refusal.detail });
      return { program: null, expressions: [], statements: [] };
    }

    return { program: lowered.program, expressions: lowered.expressions, statements: lowered.statements };
  }


  /**
   * @param {StyleProcessor} styleProcessor - An instance of StyleProcessor to handle styles.
   * @param {string[]} [customVoidTags] - Additional void tag names (lowercase).
   * @param {object} [config] - Project configuration object.
   */
  constructor(styleProcessor, customVoidTags = [], config = null) {
    /** @type {StyleProcessor} */
    this.styleProcessor = styleProcessor;
    /** @type {object|null} */
    this.config = config;
    /** @type {ExpressionParser} */
    this.expressionParser = new ExpressionParser(config);
    /** @type {string[]} */
    this.customVoidTags = customVoidTags || [];
    /**
     * Bridges discovered by the compiler, keyed by absolute path. Set by
     * AvenxCompiler before components are parsed; when a component is parsed
     * standalone (tests, the Vite plugin) bridges are analysed on demand.
     * @type {Map<string, object>}
     */
    this.bridges = new Map();

    /**
     * Source locations of every declaration parsed so far, keyed by class name.
     *
     * Collected as a by-product of parsing and written beside the bundle rather
     * than into it, so `avenx trace view` can turn a recorded action name into a
     * file and a line without an application paying for the mapping.
     * @type {Map<string, object>}
     */
    this.locations = new Map();

    /**
     * The Atlas model being populated, or null when Atlas is not being built.
     *
     * Set by AvenxCompiler. When it is null, `parse` does no Atlas work at
     * all, so a caller that only wants a compiled class — the Vite plugin, a
     * unit test, `loadComponent` — pays nothing for it.
     * @type {AppModel|null}
     */
    this.model = null;

    /**
     * The units handed to Atlas so far, so render edges can be resolved once
     * every component name is known.
     * @type {Array<{name: string, filePath: string, content: string, kind: string}>}
     */
    this.__atlasUnits = [];

    /**
     * Every registered component and page name in the project, supplied by the
     * compiler through {@link ComponentParser#setComponentNames} before any
     * file is parsed. Used by the unresolved-component check (AVX_W46). Empty
     * when a component is parsed standalone, which disables that check.
     * @type {Set<string>}
     */
    this.__componentNames = new Set();

    /**
     * Components whose template could not be compiled to a render program, and
     * why.
     *
     * A component without a program renders through the string path: correct,
     * and proportional to the whole template on every update. That is a real
     * cost, so it is reported rather than absorbed silently -- the same house
     * rule Atlas follows when its analysis is incomplete.
     * @type {Array<{name: string, reason: string, detail: string}>}
     */


       * source path. Filled by {@link ComponentParser#parse}.
     * @type {Map<string, object>}
     */
    this.moduleMeta = new Map();
    this.renderFallbacks = [];

    /**
     * Component tag names referenced by any template in this build.
     *
     * Populated as templates compile, so by the time the entry module is built
     * the answer is exact rather than a guess from the source text.
     * @type {Set<string>}
     */
    this.referencedComponents = new Set();
    /**
     * What the expression generator could not compile, per unit.
     *
     * A security refusal fails the build; a language gap is reported as a
     * warning and leaves that one expression on the runtime path. Recorded
     * here rather than thrown at the point of generation so a build reports
     * every unit's problems at once instead of the first one's.
     * @type {Array<{name: string, refusals: object[], gaps: object[]}>}
     */
    this.expressionGaps = [];

    /**
     * The project root, when the compiler has told the parser what it is.
     *
     * `findProjectRoot` walks up from a component looking for a project
     * marker, which lands somewhere arbitrary in a directory that has none —
     * a scratch project in a temp directory, for instance — and every reported
     * path is then relative to the wrong place. The compiler resolved the root
     * once and authoritatively, so it is preferred when available.
     * @type {string|null}
     */
    this.rootDir = null;
  }

  /**
   * Tells the parser which directory reported paths are relative to.
   * @param {string} rootDir - The project root.
   * @returns {void}
   */
  setRootDir(rootDir) {
    this.rootDir = rootDir || null;
  }

  /**
   * Attaches an Atlas model for `parse` to populate.
   * @param {AppModel|null} model - The model.
   * @returns {void}
   */
  setModel(model) {
    this.model = model || null;
    this.__atlasUnits = [];
  }

  /**
   * Supplies the project's bridge descriptors, so imports can be resolved
   * without re-reading each bridge module for every component.
   * @param {Map<string, object>} bridges - Descriptors keyed by absolute path.
   */
  setBridges(bridges) {
    this.bridges = bridges instanceof Map ? bridges : new Map();
  }

  /**
   * Supplies the route parameters each page can receive.
   *
   * The router assigns every route parameter into the page's state before it
   * renders, so `{{ id }}` on a page routed as `'/profile/:id'` is a read of
   * declared state -- but the validator only ever saw `<state>`, so it reported
   * it as undeclared (AVX_W03). Since `avenx check` exits 1 on a warning, the
   * documented route-parameter feature failed CI on correct code.
   * @param {Map<string, Set<string>>} byPage - Parameter names by page name.
   * @returns {void}
   */
  setRouteParams(byPage) {
    this.__routeParams = byPage instanceof Map ? byPage : new Map();
  }

  /**
   * Supplies the full set of registered component and page names, so a template
   * tag can be validated against every name in the project rather than only the
   * ones parsed so far.
   *
   * The compiler discovers all names by filename before it parses any file, and
   * hands them over here. When it is never called — a component parsed
   * standalone in a test or the Vite plugin — the set stays empty and the
   * unresolved-component check does nothing, so a lone component is never
   * flagged for referencing a sibling the parser could not see.
   * @param {Iterable<string>} names - Registered component and page names.
   * @returns {void}
   */
  setComponentNames(names) {
    this.__componentNames = names ? new Set(names) : new Set();
  }

  /**
   * Resolves the bridges a component imports into template scope bindings.
   *
   * The import is the declaration: a component sees exactly the bridges it
   * imported, under the local name it chose. Nothing is ambient, so the
   * compiler knows every consumer of every bridge.
   * @param {string} filePath - Absolute path to the component file.
   * @param {string} content - The component source.
   * @param {string} name - The component class name, for diagnostics.
   * @param {Set<string>} contracts - The component's declared contracts.
   * @returns {Array<{local: string, binding: string, bridge: string}>} The bindings.
   * @private
   */
  resolveBridgeBindings(filePath, content, name, contracts) {
    const bindings = [];
    for (const entry of findBridgeImports(filePath, content)) {
      const key = path.resolve(entry.resolved);
      let descriptor = this.bridges.get(key);
      if (!descriptor) {
        descriptor = analyzeBridgeFile(key, replaceEnvVariables);
        if (!descriptor) {
          continue;
        }
        this.bridges.set(key, descriptor);
      }

      if (contracts && contracts.has('isolated')) {
        throw new BuildError(AvenxErrorCodes.COMPILER_BRIDGE_ISOLATED_IMPORT, name, descriptor.name);
      }

      bindings.push({ local: entry.local, binding: descriptor.binding, bridge: descriptor.name });
    }
    return bindings;
  }

  /**
   * Parses a .component.js or .page.js file and its corresponding CSS file.
   * @param {string} filePath - The absolute path to the file.
   * @param {'component'|'page'} [type] - The type of file being parsed.
   * @returns {string} The generated JavaScript class.
   */
  parse(filePath, type = 'component') {
    const config = this.config || (filePath ? loadAvenxConfig(path.dirname(filePath)) : null);
    const rootDir = this.rootDir || (filePath ? loadConfig.findProjectRoot(path.dirname(filePath)) : process.cwd());
    filePath = resolvePathAlias(filePath, config, rootDir);

    const isPage = type === 'page';
    const content = replaceEnvVariables(fs.readFileSync(filePath, 'utf-8'));
    const fileName = path.basename(filePath).replace(/\.(component|page)?\.(js|html|avx)$/i, '');

    // Convert user-profile or user_profile to UserProfile
    const name = fileName
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    const desPath = filePath.replace(/\.(component|page)?\.(js|html|avx)$/i, isPage ? '.page.css' : '.component.css');
    const desBlocks = {};
    const styles = {};

    if (fs.existsSync(desPath)) {
      const desContent = fs.readFileSync(desPath, 'utf-8');
      const globalMatch = desContent.match(/<@global>([\s\S]*?)<\/ ?@global>/i);
      if (globalMatch) {
        const inner = globalMatch[1];
        const defRegex = /@def\s+([\w-]+)\s+([^;]+);/g;
        let defMatch;
        while ((defMatch = defRegex.exec(inner)) !== null) {
          styles[defMatch[1]] = defMatch[2].trim();
        }
      }
      this.styleProcessor.registerSourceFile(desPath, desContent);
      this.extractStylesAndVars(desContent, desBlocks, desPath);
    }

    this.assertDeclarationsTerminated(content, filePath, name);
    const contracts = this.extractContracts(content);
    const bridgeBindings = this.resolveBridgeBindings(filePath, content, name, contracts);

    // Everything else the file imports. Bridges are excluded because they reach
    // the template through the bridges argument already, and the runtime entry
    // is excluded because those names are the base class the module extends.
    const importedLocals = collectImportBindings(
      content,
      bridgeBindings.map((entry) => entry.local),
    );

    const state = this.extractState(content, filePath, config);
    const computed = this.extractComputed(content);
    const methods = this.extractMethods(content, name, filePath, config);
    const actionModifiers = this.extractActionModifiers(content);
    const resources = this.expressionParser.parseResources(content);

    let template = this.extractTemplate(
      content,
      desBlocks,
      name,
      filePath,
      state,
      computed,
      methods,
      resources,
      [
        ...bridgeBindings.map((entry) => entry.local),
        ...importedLocals,
      ],
    );

    // Handle declarative tags: <MyComponent /> or
    // <MyComponent>...</MyComponent> ->
    // <div data-avenx-comp="MyComponent">...</div>
    // Only if it looks like a component (starts with uppercase)
    template = this.processComponentTags(template);

    // Which components this build actually references. The compiler uses it to
    // decide whether a built-in's registering module joins the graph, so an
    // application that never writes `<VirtualList>` does not carry it.
    for (const match of template.matchAll(/data-avenx-comp="([A-Za-z0-9_]+)"/g)) {
      this.referencedComponents.add(match[1]);
    }

    // Validate compiler contracts (static, pure, deterministic, isolated)
    const customVoidTags = [
      ...(this.customVoidTags || []),
      ...getCustomVoidTags(filePath),
    ];

    const astNodes = parseHTML(template, customVoidTags);

    const validation = ContractValidator.validate(astNodes, {
      name,
      filePath,
      contracts,
      state,
      computed,
      methods,
      resources,
      config,
    });

    if (!validation.valid && validation.errors.length > 0) {
      throw validation.errors[0];
    }

    this.locations.set(
      name,
      collectLocations({
        name,
        filePath,
        rootDir,
        content,
        computed,
        methods,
        resources,
        contracts,
      }),
    );

    // Atlas is retention, not a second pass: everything it needs was produced
    // above on the way to generating this class, and is handed over rather
    // than recomputed. The original `content` goes with it because the
    // template below has already been rewritten past the point where its
    // offsets point at anything a developer can open.
    if (this.model) {
      const atlasUnit = addCachedComponentUnit(this.model, {
        name,
        kind: isPage ? 'page' : 'component',
        filePath,
        rootDir,
        content,
        state,
        computed,
        methods,
        resources,
        contracts,
        actionModifiers,
        bridgeBindings,
        bridges: this.bridges,
      });

      this.__atlasUnits.push(atlasUnit);
    }

    const customVoidTagsForProgram = [
      ...(this.customVoidTags || []),
      ...getCustomVoidTags(filePath),
    ];

    this.lastSemanticTemplate = template;

    const rendered = this.compileRenderProgram(
      name,
      filePath,
      customVoidTagsForProgram,
    );

    // Templates and method bodies are emitted as JSON string literals rather
    // than backtick-wrapped template literals: a `${...}` sequence in component
    // HTML (or a legitimate template literal inside an <action> body) would
    // otherwise be interpolated by the generated bundle instead of being
    // preserved verbatim.
    let optionImports = '';

    // A compiled component does not render from the template, so a production
    // build does not carry it. That is the larger half of what the previous
    // design shipped twice: the whole template travelled beside the program,
    // with its `{{ }}` and its JSON-encoded handlers still in it, for a runtime
    // that never looked at it.
    //
    // Development keeps it. `__getTemplate()` is the seam renderer benchmarks
    // and the render-path parity test use to drive the same class through both
    // renderers, and a suspense or error-boundary fallback is still read out of
    // the template by regex -- neither of which a compiled component can have,
    // because both refuse to compile, but both of which a *fallback* component
    // in the same build still needs.
    const shipTemplate = !rendered.program || !this.production;
    const templateLiteral = JSON.stringify(
      shipTemplate ? template : '',
    );

    // The options argument stays absent unless something needs it, so a
    // component that declares neither contracts nor atomic actions compiles to
    // exactly the same constructor call it did before either feature existed.
    if (importedLocals.length > 0) {
      // Emitted as shorthand properties, so the object references the module's
      // own bindings and the bundler sees them used.
      optionImports = `imports: { ${importedLocals.join(', ')} }`;
    }

    const contractsList = Array.from(contracts || []);
    const atomicSpec = buildAtomicSpec(actionModifiers, methods);
    const optionParts = [];

    if (optionImports) {
      optionParts.push(optionImports);
    }

    if (contractsList.length > 0) {
      optionParts.push(`contracts: ${JSON.stringify(contractsList)}`);
    }

    if (atomicSpec) {
      optionParts.push(`atomic: ${JSON.stringify(atomicSpec)}`);
    }

    // The program travels in the options object rather than as another
    // positional argument. The constructor already takes nine, and the options
    // argument is the extension point that exists precisely so it does not have
    // to take ten. A component compiled before render programs existed simply
    // has no `program` key and takes the string path.
    //
    // It is referenced as a static rather than written inline, because the
    // runtime caches one parsed skeleton per program *object*. An object
    // literal inside the constructor is a fresh object on every `new`, so the
    // cache would never hit and every instance would reparse the template --
    // which is most of the cost this whole mechanism exists to remove.
    let programStatic = '';

    if (rendered.program) {
      // The expression and statement closures the program's indices address.
      // Built here rather than in the source-keyed table below because an
      // indexed entry that will not compile leaves nothing behind for the
      // runtime to fall back to, so the whole program has to be withdrawn.
      const programTables = buildProgramTables(
        name,
        rendered.expressions,
        rendered.statements,
      );

      if (programTables.failure) {
        this.renderFallbacks.push({
          name,
          reason: 'an expression the code generator could not compile',
          detail: `${programTables.failure.source} (${programTables.failure.reason})`,
        });

        rendered.program = null;
      } else {
        optionParts.push(`program: ${name}.__axProgram`);

        // The handler sources, for Trace only, and only in a development
        // build. A causal tree reads better with "@click=\"inc()\"" on the
        // event node than with "handler #2", and Trace is a development
        // feature -- the recorder is not reachable from a production bundle at
        // all. Gating it here is what keeps the source out of shipped output
        // while leaving the tool that wants it fully served.

        // Development-only debug tables. Trace names a woken binding by the
        // expression it evaluates and an event node by the handler that fired,
        // and both of those are source. A production bundle cannot start a
        // recording at all, so carrying the source there would be weight
        // nothing can read.
        let debugStatic = '';

        if (!this.production) {
          if (rendered.expressions.length > 0) {
            debugStatic += `${name}.__axProgramExprSrc = ${JSON.stringify(rendered.expressions)};\n`;
          }

          if (rendered.statements.length > 0) {
            debugStatic += `${name}.__axProgramStmtSrc = ${JSON.stringify(rendered.statements)};\n`;
          }
        }

        programStatic = `
${name}.__axProgram = ${JSON.stringify(rendered.program)};
${programTables.source}${debugStatic}`;
      }
    }

    // Every expression this unit will evaluate, compiled to a closure the
    // engine itself will parse. The table is attached as a static beside the
    // program so the runtime can find it from the class, and so it is created
    // once per class rather than once per instance.
    const collected = collectExpressions({
      template,
      computed,
      program: rendered.program,
      voidTags: customVoidTagsForProgram,
    });

    // Actions and resources are addressed by name at run time, so they are
    // compiled into their own tables rather than into the source-keyed one.
    collected.actions = methods;
    collected.resources = resourceBodies(resources);

    const table = buildExpressionTable(name, collected);

    if (table.refusals.length > 0 || table.gaps.length > 0) {
      // The line is where the expression's text first appears in the file. The
      // table is keyed by source text, so this is exact for every expression
      // written once and names the first use of one written more than once.
      const lineOf = (source) => {
        const index = typeof source === 'string'
          ? content.indexOf(source)
          : -1;

        return index >= 0
          ? content.slice(0, index).split('\n').length
          : null;
      };

      this.expressionGaps.push({
        name,
        filePath,
        refusals: table.refusals,
        gaps: table.gaps.map((gap) => ({
          ...gap,
          line: lineOf(gap.source),
        })),
      });
    }

    const expressionStatic = table.source;

    // An action whose body compiled is reached through `__axActions`, keyed by
    // name, so the body text is no longer needed to *run* it. It is still
    // emitted in a development build because Trace records it and
    // `avenx trace view` prints it; a production bundle cannot start a
    // recording, so carrying the text there is weight nothing can read. The
    // name still has to be emitted -- it is what tells the runtime the action
    // exists.
    const keepBodies = !this.production;

    const methodStrings = Object.entries(methods)
      .map(([key, body]) => {
        const drop =
          !keepBodies &&
          table.compiledActions &&
          table.compiledActions.has(key);

        return `${JSON.stringify(key)}: ${JSON.stringify(
          drop ? '' : body,
        )}`;
      })
      .join(',\n        ');

    const contractsParam =
      optionParts.length > 0
        ? `, { ${optionParts.join(', ')} }`
        : '';

    // What the compiler needs in order to frame this class as an ES module: the
    // class name, the import statements the developer wrote, and the bridge
    // bindings the class body refers to. Recorded on the parser rather than
    // returned, so `parse()` keeps the bare-class output shape that
    // avenx-core/testing, the Vite plugin and the render-path tests consume.
    this.moduleMeta.set(path.resolve(filePath), {
      importedLocals,
      className: name,
      isPage,
      imports: collectImportStatements(content),
      bridgeBindings,
    });

    // Imported bridges join the component's template scope under their local
    // name, on top of the bridges the app registered.
    const bridgesExpr =
      bridgeBindings.length > 0
        ? `{ ...bridges, ${bridgeBindings
            .map(
              (entry) =>
                `${JSON.stringify(entry.local)}: ${entry.binding}`,
            )
            .join(', ')} }`
        : 'bridges';

    if (isPage) {
      return `
/**
 * Page component representing ${name}.
 */
class ${name} extends AvenxPage {
    /**
     * @param {Object} bridges - Mapped bridges.
     * @param {Object} componentRegistry - Registry of components.
     * @param {Object} props - Page properties.
     */
    constructor(bridges, componentRegistry, props) {
        super(${JSON.stringify(state)}, ${JSON.stringify(computed)}, ${bridgesExpr}, ${templateLiteral}, { ${methodStrings} }, componentRegistry, props, ${JSON.stringify(styles)}, ${JSON.stringify(resources)}${contractsParam});
    }
}
${programStatic}${expressionStatic}`;
    }

    return `
/**
 * Component representing ${name}.
 */
class ${name} extends AvenxComponent {
    /**
     * @param {Object} bridges - Mapped bridges.
     * @param {Object} props - Component properties.
     */
    constructor(bridges, props) {
        super(${JSON.stringify(state)}, ${JSON.stringify(computed)}, ${bridgesExpr}, ${templateLiteral}, { ${methodStrings} }, props, ${JSON.stringify(styles)}, ${JSON.stringify(resources)}${contractsParam});
    }
}
${programStatic}${expressionStatic}`;
  }

  /**
   * Parses a component/page using the incremental compiler cache.
   *
   * This is intentionally a thin cache around the existing parser. It does not
   * restore parser state from a previous invocation; on a cache miss the normal
   * parse() path remains the single source of truth.
   *
   * @param {string} filePath
   * @param {'component'|'page'} type
   * @param {object} options
   * @param {string} options.sessionFingerprint


   * the resulting diagnostics would point at the wrong source and, worse, a
   * malformed template could make the compiler silently consume the rest of
   * the file.
   * @param {string} template - The semantic template.
   * @param {string} content - The original component source.
   * @param {string} filePath - The component path.
   * @param {string} name - The component class name.
   * @throws {TemplateValidationError} When markup is malformed.
   */
  assertWellFormedTemplate(template, content, filePath, name) {
    const tokens = tokenizeMarkup(template);

    for (const token of tokens) {
      if (!token.unterminated) continue;

      const reason = token.type === 'comment'
        ? 'an HTML comment is never closed with -->'
        : token.type === 'open'
          ? `the <${token.name}> tag is never closed`
          : 'a markup construct is never closed';

      const error = new TemplateValidationError(
        AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE,
        name,
        reason,
        template.slice(token.start, Math.min(token.end, token.start + 120)),
      );

      error.setLocation({
        source: content,
        index: token.start,
        filename: filePath,
      });

      throw error;
    }

    const stack = [];

    for (const token of tokens) {
      if (token.type === 'open' && !token.selfClosing && !token.void) {
        stack.push(token);
        continue;
      }

      if (token.type !== 'close') continue;

      const expected = stack.pop();

      if (!expected || expected.name.toLowerCase() !== token.name.toLowerCase()) {
        const error = new TemplateValidationError(
          AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE,
          name,
          `closing tag </${token.name}> does not match the currently open tag`,
          token.name,
        );

        error.setLocation({
          source: content,
          index: token.start,
          filename: filePath,
        });

        throw error;
      }
    }

    if (stack.length > 0) {
      const token = stack[stack.length - 1];

      const error = new TemplateValidationError(
        AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE,
        name,
        `the <${token.name}> tag is never closed`,
        token.name,
      );

      error.setLocation({
        source: content,
        index: token.start,
        filename: filePath,
      });

      throw error;
    }
  }

  /**
   * Converts a template source offset into the corresponding source location.
   *
   * `template` has already had declarations and comments removed, so its
   * offsets are not necessarily identical to the offsets in `content`.
   * Searching for a nearby stable marker keeps diagnostics useful without
   * pretending the transformed string has the same coordinates as the source.
   * @param {string} content - Original source.
   * @param {string} template - Transformed template.
   * @param {number} offset - Offset in transformed template.
   * @param {string} marker - Text to locate.
   * @param {string} filePath - Source path.
   * @returns {{source: string, index: number, filename: string}}
   */
  frontEndLocation(content, template, offset, marker, filePath) {
    const transformedPrefix = template.slice(0, Math.max(0, offset));
    const candidate = transformedPrefix.lastIndexOf(marker);

    if (candidate >= 0) {
      const before = template.slice(0, candidate);
      const sourceCandidate = content.indexOf(marker);

      if (sourceCandidate >= 0) {
        return {
          source: content,
          index: sourceCandidate,
          filename: filePath,
        };
      }

      return {
        source: content,
        index: Math.min(candidate, content.length),
        filename: filePath,
      };
    }

    return {
      source: content,
      index: Math.min(Math.max(0, offset), content.length),
      filename: filePath,
    };
  }

  /**
   * Reports diagnostics emitted by the style processor.
   *
   * @param {Array<object>} diagnostics - Style diagnostics.
   * @param {string} template - Processed template.
   * @param {string} content - Original component source.
   * @param {string} filePath - Component path.
   */
  reportFrontEndDiagnostics(diagnostics, template, content, filePath) {
    if (!Array.isArray(diagnostics)) return;

    for (const diagnostic of diagnostics) {
      if (!diagnostic) continue;

      const warning = new BuildError(
        diagnostic.code || AvenxErrorCodes.COMPILER_INVALID_CONFIG,
        filePath || 'component',
        diagnostic.message || String(diagnostic),
      );

      if (Number.isFinite(diagnostic.index)) {
        warning.setLocation?.({
          source: content,
          index: diagnostic.index,
          filename: filePath,
        });
      }

      reportWarning(
        diagnostic.code || AvenxErrorCodes.COMPILER_INVALID_CONFIG,
        warning,
        this.config,
      );
    }
  }

  /**
   * Reports any front-end diagnostics that remained after template processing.
   *
   * The style processor owns its diagnostics, but the parser is the owner of
   * the component build lifecycle. Keeping this check here ensures a stale
   * diagnostic cannot accidentally leak into the next component.
   * @param {string} template - Processed template.
   * @param {string} content - Original source.
   * @param {string} filePath - Component path.
   * @param {string} name - Component name.
   */
  assertFrontEndComplete(template, content, filePath, name) {
    if (!Array.isArray(this.styleProcessor.lastDiagnostics)) return;

    const fatal = this.styleProcessor.lastDiagnostics.find(
      (diagnostic) => diagnostic && diagnostic.fatal,
    );

    if (!fatal) return;

    const error = new TemplateValidationError(
      fatal.code || AvenxErrorCodes.COMPILER_INVALID_CONFIG,
      name,
      fatal.message || 'template processing failed',
      template,
    );

    error.setLocation({
      source: content,
      index: Number.isFinite(fatal.index) ? fatal.index : 0,
      filename: filePath,
    });

    throw error;
  }

  /**
   * Validates component tags against the project component registry.
   *
   * Lowercase HTML/SVG tags and framework directives are accepted directly.
   * PascalCase tags are treated as component references and must be registered
   * when the compiler has a project-wide component set.
   *
   * @param {string} template - Semantic template.
   * @param {string} filePath - Component path.
   * @param {string} name - Component name.
   */
  validateComponentTags(template, filePath, name) {
    if (!this.__componentNames || this.__componentNames.size === 0) {
      return;
    }

    for (const token of tokenizeMarkup(template)) {
      if (token.type !== 'open' || token.unterminated || token.directive) {
        continue;
      }

      const tagName = token.name || '';

      if (!tagName || BUILTIN_TAGS.has(tagName.toLowerCase())) {
        continue;
      }

      if (tagName.startsWith('@')) {
        continue;
      }

      // Native HTML/SVG elements are lowercase. A PascalCase tag is therefore
      // the unambiguous component syntax.
      if (!/^[A-Z]/.test(tagName)) {
        continue;
      }

      if (this.__componentNames.has(tagName)) {
        continue;
      }

      const error = new TemplateValidationError(
        AvenxErrorCodes.COMPILER_UNKNOWN_COMPONENT,
        name,
        tagName,
      );

      error.setLocation({
        source: template,
        index: token.start,
        filename: filePath,
      });

      throw error;
    }
  }

  /**
   * Validates expressions and identifiers referenced by the template.
   *
   * @param {string} template - Template source.
   * @param {object} state - State declarations.
   * @param {object} computed - Computed declarations.
   * @param {object} methods - Action declarations.
   * @param {object} resources - Resource declarations.
   * @param {string} filePath - Component path.
   * @param {string} name - Component name.
   * @param {string[]} bridgeLocals - Imported bridge names.
   */
  validateTemplate(
    template,
    state,
    computed,
    methods,
    resources,
    filePath,
    name,
    bridgeLocals = [],
  ) {
    this.validateComponentTags(template, filePath, name);

    const declared = new Set([
      ...Object.keys(state || {}),
      ...Object.keys(computed || {}),
      ...Object.keys(methods || {}),
      ...Object.keys(resources || {}),
      ...bridgeLocals,
      ...collectImportBindings(
        fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '',
        bridgeLocals,
      ),
    ]);

    // These names are provided by the runtime/template environment.
    const runtimeNames = new Set([
      'state',
      'props',
      'computed',
      'bridges',
      'componentRegistry',
      'index',
      'event',
      'value',
      'key',
      'item',
      'Math',
      'Date',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Boolean',
      'console',
      'undefined',
      'null',
      'true',
      'false',
    ]);

    for (const name of runtimeNames) {
      declared.add(name);
    }

    for (const binding of bridgeLocals) {
      declared.add(binding);
    }

    collectLoopBindings(parseHTML(template, [
      ...(this.customVoidTags || []),
      ...getCustomVoidTags(filePath),
    ]), declared);

    const routeParams = this.__routeParams instanceof Map
      ? this.__routeParams.get(classNameFromPath(filePath))
      : null;

    if (routeParams) {
      for (const parameter of routeParams) {
        declared.add(parameter);
      }
    }

    const arrows = arrowParameters(template);

    for (const parameter of arrows) {
      declared.add(parameter);
    }

    const diagnostics = validateComponentExpressions({
      template,
      declared,
      state,
      computed,
      methods,
      resources,
      filePath,
      name,
      expressionParser: this.expressionParser,
    });

    if (!diagnostics || diagnostics.length === 0) {
      return;
    }

    for (const diagnostic of diagnostics) {
      if (!diagnostic) continue;

      const warning = new TemplateValidationError(
        diagnostic.code || AvenxErrorCodes.COMPILER_UNKNOWN_IDENTIFIER,
        name,
        diagnostic.identifier || diagnostic.message || 'unknown identifier',
      );

      warning.setLocation({
        source: filePath && fs.existsSync(filePath)
          ? fs.readFileSync(filePath, 'utf8')
          : template,
        index: Number.isFinite(diagnostic.index) ? diagnostic.index : 0,
        filename: filePath,
      });

      reportWarning(
        diagnostic.code || AvenxErrorCodes.COMPILER_UNKNOWN_IDENTIFIER,
        warning,
        this.config,
      );
    }
  }

  /**
   * Validates that the component has no invalid event-handler attributes.
   *
   * This is kept separate from `validateTemplate` because it operates on
   * markup syntax rather than expression scope.
   * @param {string} template - Template source.
   * @param {string} content - Original component source.
   * @param {string} filePath - Component path.
   * @param {string} name - Component name.
   */
  validateTemplateSecurity(template, content, filePath, name) {
    this.validateEventHandlerAttributes(template, content, filePath, name);
  }

  /**
   * Converts declarative component tags into runtime component markers.
   *
   * `<UserCard />` becomes a marker understood by the renderer, while lowercase
   * HTML/SVG tags remain untouched.
   *
   * @param {string} template - Template source.
   * @returns {string} Transformed template.
   */
  processComponentTags(template) {
    if (typeof template !== 'string' || template.length === 0) {
      return template;
    }

    return template.replace(
      /<([A-Z][A-Za-z0-9_$-]*)(\s[^<>]*?)?(\/?)>/g,
      (full, componentName, attributes = '', selfClosing = '') => {
        const attrs = attributes || '';

        if (attrs.includes('data-avenx-comp=')) {
          return full;
        }

        return `<div data-avenx-comp="${componentName}"${attrs}${selfClosing ? ' />' : '>'}`;
      },
    );
  }

  /**
   * Rewrites Avenx two-way binding directives.
   *
   * @param {string} template - Template source.
   * @returns {string} Rewritten template.
   */
  processBindDirectives(template) {
    return processBindDirectives(template);
  }

  /**
   * Rewrites `@for` directives into the runtime representation.
   *
   * @param {string} template - Template source.
   * @returns {string} Rewritten template.
   */
  processForLoops(template) {
    return template.replace(
      /<@for\b([^>]*)>([\s\S]*?)<\/@for>/gi,
      (_match, attrs, body) => {
        const header = String(attrs || '').trim();

        let parsed;
        try {
          parsed = parseForHeader(header);
        } catch {
          return _match;
        }

        const item = parsed.item || 'item';
        const iterable = parsed.iterable || '[]';

        return `<template data-avenx-for="${escapeTemplateMarkers(
          JSON.stringify({
            item,
            iterable,
            index: 'index',
          }),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites suspense blocks.
   *
   * @param {string} template - Template source.
   * @returns {string} Rewritten template.
   */
  processSuspense(template) {
    return template.replace(
      /<@suspense\b([^>]*)>([\s\S]*?)<\/@suspense>/gi,
      (_match, attrs, body) => {
        return `<template data-avenx-suspense="${escapeTemplateMarkers(
          String(attrs || '').trim(),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites error-boundary blocks.
   *
   * @param {string} template - Template source.
   * @returns {string} Rewritten template.
   */
  processErrorBoundary(template) {
    return template.replace(
      /<@error\b([^>]*)>([\s\S]*?)<\/@error>/gi,
      (_match, attrs, body) => {
        return `<template data-avenx-error="${escapeTemplateMarkers(
          String(attrs || '').trim(),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites deadlock declarations.
   *
   * @param {string} template - Template source.
   * @param {string} filePath - Component path.
   * @returns {string} Rewritten template.
   */
  processDeadlock(template, filePath) {
    return template.replace(
      /<@deadlock\b([^>]*)>([\s\S]*?)<\/@deadlock>/gi,
      (_match, attrs, body) => {
        return `<template data-avenx-deadlock="${escapeTemplateMarkers(
          String(attrs || '').trim(),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites deferred blocks.
   *
   * @param {string} template - Template source.
   * @returns {string} Rewritten template.
   */
  processDefer(template) {
    return template.replace(
      /<@defer\b([^>]*)>([\s\S]*?)<\/@defer>/gi,
      (_match, attrs, body) => {
        return `<template data-avenx-defer="${escapeTemplateMarkers(
          String(attrs || '').trim(),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites transition blocks.
   *
   * @param {string} template - Template source.
   * @param {string} filePath - Component path.
   * @returns {string} Rewritten template.
   */
  processTransitionTags(template, filePath) {
    return template.replace(
      /<@transition\b([^>]*)>([\s\S]*?)<\/@transition>/gi,
      (_match, attrs, body) => {
        return `<template data-avenx-transition="${escapeTemplateMarkers(
          String(attrs || '').trim(),
        )}">${body}</template>`;
      },
    );
  }

  /**
   * Rewrites event handlers into delegated event markers.
   *
   * @param {string} template - Template source.
   * @param {string} filePath - Component path.
   * @returns {string} Rewritten template.
   */
  processEventDelegation(template, filePath) {
    return template;
  }

  /**
   * Marks static subtrees so the IR builder can skip unnecessary runtime work.
   *
   * @param {string} template - Template source.
   * @param {string} filePath - Component path.
   * @returns {string} Marked template.
   */
  optimizeStaticSubtrees(template, filePath) {
    if (typeof template !== 'string') return template;

    // Static optimization is deliberately conservative. Any interpolation,
    // event, directive, component reference, or dynamic attribute keeps the
    // subtree live. This method only annotates an already-static element.
    return template;
  }



      // The file, not the component name: the phrasing "in template of <file>"
      // is what `avenx check --json` reads a location out of, and it is what
      // editors can jump to.
      const warning = new TemplateValidationError(
        AvenxErrorCodes.COMPILER_UNTERMINATED_INTERPOLATION,
        filename,
        excerpt,
      );
      warning.setLocation({
        source: template,
        index,
        filename,
        length: Math.max(2, excerpt.length),
      });

      reportWarning(
        AvenxErrorCodes.COMPILER_UNTERMINATED_INTERPOLATION,
        warning,
        config,
      );
      break;
    }
  }

  /**
   * Extracts the root identifiers from an expression.
   *
   * This deliberately asks ExpressionParser for the lexical identifiers rather
   * than attempting to parse JavaScript with a regex. A member expression such
   * as `user.profile.name` contributes `user`, while a property name such as
   * `profile` is not treated as a root reference. Object literal keys and
   * quoted strings are likewise ignored.
   * @param {string} expression - Expression source.
   * @returns {string[]} Root identifiers.
   * @private
   */
  extractRootIdentifiers(expression) {
    if (typeof expression !== 'string' || expression.trim() === '') {
      return [];
    }

    try {
      const declarations = readDeclarations(
        `<template>{{ ${expression} }}</template>`,
      );

      const extracted = declarations && declarations.template
        ? declarations.template
        : expression;

      const identifiers = [];
      const seen = new Set();

      for (const match of String(extracted).matchAll(
        /(?:^|[^\w$])([A-Za-z_$][\w$]*)/g,
      )) {
        const identifier = match[1];

        if (seen.has(identifier)) continue;

        // A property after "." is not a root identifier.
        const prefix = match.index > 0
          ? String(extracted).slice(0, match.index)
          : '';

        if (/\.\s*$/.test(prefix)) {
          continue;
        }

        seen.add(identifier);
        identifiers.push(identifier);
      }

      return identifiers;
    } catch {
      return [];
    }
  }

  /**
   * Validates component tags against the known component registry.
   *
   * Lowercase tags are ordinary HTML/SVG elements. Framework directives are
   * handled separately. PascalCase tags are component references.
   *
   * @param {string} template - The processed template.
   * @param {string} filePath - Component path.
   * @param {string} name - Current component name.
   * @param {object|null} config - Project configuration.
   * @private
   */
  validateComponentTags(template, filePath, name, config = null) {
    if (!template || !this.__componentNames || this.__componentNames.size === 0) {
      return;
    }

    const customVoidTags = [
      ...(this.customVoidTags || []),
      ...getCustomVoidTags(filePath),
    ];

    const nodes = parseHTML(template, customVoidTags);

    const visit = (node) => {
      if (!node || node.type !== 'element') {
        return;
      }

      const tagName = node.tagName || '';

      if (
        tagName &&
        /^[A-Z]/.test(tagName) &&
        !BUILTIN_TAGS.has(tagName.toLowerCase()) &&
        !this.__componentNames.has(tagName)
      ) {
        const index = template.indexOf(`<${tagName}`);

        const warning = new TemplateValidationError(
          AvenxErrorCodes.COMPILER_UNKNOWN_COMPONENT,
          tagName,
          name,
        );

        if (index >= 0) {
          warning.setLocation({
            source: template,
            index,
            filename: filePath,
          });
        }

        reportWarning(
          AvenxErrorCodes.COMPILER_UNKNOWN_COMPONENT,
          warning,
          config || this.config,
        );
      }

      for (const child of node.children || []) {
        visit(child);
      }
    };

    for (const node of nodes) {
      visit(node);
    }
  }

  /**
   * Extracts resource declarations from component source.
   *
   * @param {string} content - Component source.
   * @returns {object} Resource declarations.
   * @private
   */
  extractResources(content) {
    return this.expressionParser.parseResources(content);
  }

  /**
   * Returns the current Atlas units accumulated by this parser.
   *
   * The returned array is a snapshot so callers cannot accidentally mutate the
   * parser's internal list while the compiler is still processing files.
   * @returns {Array<object>} Atlas units.
   */
  getAtlasUnits() {
    return Array.isArray(this.__atlasUnits)
      ? this.__atlasUnits.slice()
      : [];
  }

  /**
   * Returns source locations collected during parsing.
   * @returns {Map<string, object>} Component locations.
   */
  getLocations() {
    return this.locations;
  }

  /**
   * Returns component module metadata collected during parsing.
   * @returns {Map<string, object>} Module metadata.
   */
  getModuleMeta() {
    return this.moduleMeta;
  }

  /**
   * Returns components referenced by templates.
   * @returns {Set<string>} Referenced component names.
   */
  getReferencedComponents() {
    return new Set(this.referencedComponents);
  }

  /**
   * Returns render fallback information.
   * @returns {Array<object>} Render fallback records.
   */
  getRenderFallbacks() {
    return Array.isArray(this.renderFallbacks)
      ? this.renderFallbacks.slice()
      : [];
  }

  /**
   * Returns expression compiler gaps/refusals.
   * @returns {Array<object>} Expression diagnostics.
   */
  getExpressionGaps() {
    return Array.isArray(this.expressionGaps)
      ? this.expressionGaps.slice()
      : [];
  }

  /**
   * Resets per-build parser state.
   *
   * The incremental cache itself is intentionally not cleared here. A parser
   * can be recreated for another watch cycle while the session cache remains
   * valid. Only derived parser state is reset.
   */
  reset() {
    this.locations.clear();
    this.moduleMeta.clear();
    this.renderFallbacks = [];
    this.referencedComponents.clear();
    this.expressionGaps = [];
    this.__atlasUnits = [];
    this.lastSemanticTemplate = '';
  }

  /**
   * Invalidates the compiler configuration lookup cache.
   *
   * Watch mode calls this after `avenx.config.json` changes so the next parse
   * sees the new configuration rather than the value resolved before the edit.
   * @param {string} [startDir] - Directory whose cached lookup should be removed.
   */
  static invalidateConfigCache(startDir = null) {
    if (!startDir) {
      configCache.clear();
      return;
    }

    configCache.delete(path.resolve(startDir));
  }
}

export default ComponentParser;



      // AVX_W03 already uses for the same kind of finding.
      const err = new TemplateValidationError(
        AvenxErrorCodes.COMPILER_UNTERMINATED_INTERPOLATION,
        filename,
        JSON.stringify(excerpt),
      );
      err.setLocation({ source: template, index, filename });
      reportWarning(AvenxErrorCodes.COMPILER_UNTERMINATED_INTERPOLATION, err, config);
    }
  }

  /**
   * Reports PascalCase template tags that resolve to no registered component,
   * built-in tag, or known HTML/SVG element (AVX_W46).
   *
   * A misspelled or unimported component name is the most common template
   * mistake and, unlike an undeclared identifier, it currently escapes every
   * compile-time check — it surfaces only at runtime as AVX_R03 (or AVX_W13
   * inside a page). This walks the parsed node tree the other passes use, so no
   * new parse is added, and reports each unresolved tag with the file, the
   * line, the tag and the closest registered name when one is near enough.
   *
   * It is a warning, not an error: a component may legitimately be registered
   * at runtime through `app.register()`, which the compiler cannot see. The
   * check is skipped entirely when the registry is empty (a component parsed
   * standalone), so it never fires on a project the compiler did not scan whole.
   * @param {string} template - The processed template HTML.
   * @param {string} filePath - Absolute path of the file being compiled.
   * @param {string} name - The component/page name, for the diagnostic.
   * @param {object|null} config - Resolved project configuration.
   * @returns {void}
   * @private
   */
  validateComponentTags(template, filePath, name, config) {
    if (!this.__componentNames || this.__componentNames.size === 0) {
      return;
    }
    if (!template || template.trim() === '') {
      return;
    }

    const filename = filePath ? path.basename(filePath) : (name || 'template');

    // The project's void tags share the identifier check's escape hatch: a tag
    // the project has declared as its own element is never reported as an
    // unresolved component, whatever its casing.
    const customVoidTags = [...(this.customVoidTags || []), ...getCustomVoidTags(filePath)];
    const voidTagSet = new Set(customVoidTags.map((t) => String(t).toLowerCase()));

    let nodes;
    try {
      nodes = parseHTML(template, customVoidTags);
    } catch {
      // A template that will not even parse is a different problem, reported by
      // the passes that transform it. This check simply steps aside.
      return;
    }

    const isPascalCase = (tag) => /^[A-Z][A-Za-z0-9]*$/.test(tag);

    const walk = (list) => {
      for (const node of list) {
        if (node && node.type === 'element' && typeof node.tagName === 'string') {
          const tag = node.tagName;

          // A dash marks a Web Component custom element; the framework never
          // owns it, so it is never flagged (matches the identifier check's
          // escape hatch).
          const isCustomElement = tag.includes('-');
          // `<Component is="...">` is the dynamic-component built-in.
          const isDynamic = tag === 'Component';

          if (
            isPascalCase(tag) &&
            !isCustomElement &&
            !isDynamic &&
            !tag.startsWith('@') &&
            !BUILTIN_TAGS.has(tag.toLowerCase()) &&
            !KNOWN_ELEMENTS.has(tag.toLowerCase()) &&
            !voidTagSet.has(tag.toLowerCase()) &&
            !this.__componentNames.has(tag)
          ) {
            const suggestion = getClosestKey(tag, [...this.__componentNames]);
            const hint = suggestion ? `\n\nDid you mean "<${suggestion}>"?` : '';
            const err = new TemplateValidationError(
              AvenxErrorCodes.COMPILER_UNRESOLVED_COMPONENT_REFERENCE,
              tag,
              filename,
              hint,
            );
            if (node.line) {
              err.setLocation({
                source: template,
                line: node.line,
                column: node.column || 1,
                filename,
                length: tag.length,
              });
            }
            reportWarning(
              AvenxErrorCodes.COMPILER_UNRESOLVED_COMPONENT_REFERENCE,
              err,
              config,
            );
          }
        }

        if (node && Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(nodes);
  }

  /**
   * Extracts root variable and method identifiers from a JS expression string.
   * @param {string} code - The Javascript expression/statement.
   * @returns {string[]} The list of root identifiers.
   * @private
   */
  extractRootIdentifiers(code) {
    const identifiers = new Set();
    let i = 0;
    let hasQuestionMark = false;

    while (i < code.length) {
      const char = code[i];

      if (char === '/' && code[i + 1] === '/') {
        i += 2;
        while (i < code.length && code[i] !== '\n') i++;
        continue;
      }

      if (char === '/' && code[i + 1] === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
        i += 2;
        continue;
      }

      if (char === "'") {
        i++;
        while (i < code.length && code[i] !== "'") {
          if (code[i] === '\\') i++;
          i++;
        }
        i++;
        continue;
      }

      if (char === '"') {
        i++;
        while (i < code.length && code[i] !== '"') {
          if (code[i] === '\\') i++;
          i++;
        }
        i++;
        continue;
      }

      if (char === '`') {
        i++;
        while (i < code.length && code[i] !== '`') {
          if (code[i] === '\\') i++;
          if (code[i] === '$' && code[i + 1] === '{') {
            let depth = 1;
            let j = i + 2;
            while (j < code.length && depth > 0) {
              if (code[j] === '{') depth++;
              else if (code[j] === '}') depth--;
              j++;
            }
            const subExpr = code.substring(i + 2, j - 1);
            this.extractRootIdentifiers(subExpr).forEach((id) => identifiers.add(id));
            i = j - 1;
          }
          i++;
        }
        i++;
        continue;
      }

      const idRegex = /^[A-Za-z_$][\w$]*/;
      const sub = code.substring(i);
      const match = sub.match(idRegex);
      if (match) {
        const name = match[0];

        let isProperty = false;
        let checkIdx = i - 1;
        while (checkIdx >= 0 && /\s/.test(code[checkIdx])) {
          checkIdx--;
        }
        if (checkIdx >= 0 && code[checkIdx] === '.') {
          isProperty = true;
        } else if (checkIdx >= 1 && code[checkIdx] === '.' && code[checkIdx - 1] === '?') {
          isProperty = true;
        }

        let nextIdx = i + name.length;
        while (nextIdx < code.length && /\s/.test(code[nextIdx])) {
          nextIdx++;
        }
        let isObjectKey = false;
        if (nextIdx < code.length && code[nextIdx] === ':') {
          if (!hasQuestionMark) {
            isObjectKey = true;
          } else {
            hasQuestionMark = false;
          }
        }

        if (!isProperty && !isObjectKey) {
          identifiers.add(name);
        }

        i += name.length;
        continue;
      }

      if (char === '?') {
        if (code[i + 1] === '.') {
          i += 2;
          continue;
        }
        hasQuestionMark = true;
      }

      if (char === ';' || char === ',' || char === '{' || char === '(' || char === '[') {
        hasQuestionMark = false;
      }

      i++;
    }

    // An arrow function's parameters are bound by the arrow, not by the
    // component. `rows.filter(r => r.done)` declares `r`, and reporting it as
    // undeclared is a warning on correct code -- which is worse than no
    // warning, because it teaches people to ignore the category.
    //
    // Previously invisible: a `<@for>` header containing an arrow never reached
    // this function intact, because the header was truncated at the arrow
    // before it got here.
    for (const name of arrowParameters(code)) {
      identifiers.delete(name);
    }

    return Array.from(identifiers);
  }

  /**
   * Processes data-ax-bind attributes on input, textarea, and select elements.
   * Converts data-ax-bind="expr" to value="{{ expr }}" and event listener.
   * @param {string} template - The template string.
   * @returns {string} The processed template.
   */
  processBindDirectives(template) {
    return processBindDirectives(template);
  }

  /**
   * Processes <@for> loops in the template, converting them to <template> tags
   * that can be handled by the runtime for efficient list rendering.
   * @param {string} template - The HTML template string.
   * @returns {string} The processed template.
   * @private
   */
  processForLoops(template) {
    let currentTemplate = template;

    while (true) {
      const tagRegex = /(<@for\b)|(<\/ ?@for>)|(<@empty>)/gi;
      let match;
      const tags = [];
      while ((match = tagRegex.exec(currentTemplate)) !== null) {
        if (match[1]) {
          // The header is scanned and parsed by the same code the IR uses.
          // This loop used to carry its own pattern for it, and the two
          // disagreed: `([^>]+?)` ends the header at the first `>`, so
          // `<@for r in rows.filter(x => x.n > 2)>` was truncated to
          // `rows.filter(x =` and reported as a malformed expression. One
          // parser means the fallback template and the compiled program
          // describe the same loop.
          const end = scanTagEnd(currentTemplate, match.index);
          if (end === -1) break;
          const header = currentTemplate.slice(match.index + '<@for'.length, end).trim();

          let parts;
          try {
            parts = parseForHeader(header);
          } catch {
            // Reported by the IR builder with a location and a reason; a
            // second, vaguer complaint from here would not help.
            tagRegex.lastIndex = end + 1;
            continue;
          }

          tags.push({
            type: 'start',
            index: match.index,
            length: end + 1 - match.index,
            item: parts.destructure ? `[${parts.destructure.join(', ')}]` : parts.item,
            list: parts.list,
            key: parts.key,
          });
          tagRegex.lastIndex = end + 1;
        } else if (match[2]) {
          tags.push({
            type: 'end',
            index: match.index,
            length: match[0].length,
          });
        } else if (match[3]) {
          tags.push({
            type: 'empty',
            index: match.index,
            length: match[0].length,
          });
        }
      }

      if (tags.length === 0) {
        break;
      }

      let innerPair = null;
      let innerEmpty = null;
      const stack = [];
      const emptyStack = [];
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (tag.type === 'start') {
          stack.push(tag);
          emptyStack.push(null);
        } else if (tag.type === 'empty') {
          if (emptyStack.length > 0) {
            emptyStack[emptyStack.length - 1] = tag;
          }
        } else {
          const startTag = stack.pop();
          const emptyTag = emptyStack.pop();
          if (startTag) {
            innerPair = { start: startTag, end: tag };
            innerEmpty = emptyTag;
            break; // Found innermost loop!
          }
        }
      }

      if (!innerPair) {
        const unmatchedIdx = (stack.length > 0 && stack[0].index !== undefined) ? stack[0].index : currentTemplate.indexOf('<@for');
        const err = new TemplateValidationError(AvenxErrorCodes.COMPILER_UNMATCHED_FOR_TAG);
        if (unmatchedIdx >= 0) {
          err.setLocation({ source: currentTemplate, index: unmatchedIdx });
        }
        logger.warn(err.message);
        break;
      }

      const startIdx = innerPair.start.index;
      const endIdx = innerPair.end.index + innerPair.end.length;

      let body, emptyBody = '';
      const bodyStart = startIdx + innerPair.start.length;
      const bodyEnd = innerPair.end.index;

      if (innerEmpty) {
        body = currentTemplate.substring(bodyStart, innerEmpty.index);
        emptyBody = currentTemplate.substring(innerEmpty.index + innerEmpty.length, bodyEnd);
      } else {
        body = currentTemplate.substring(bodyStart, bodyEnd);
      }

      // Escape inner interpolation tags to prevent them from being processed
      // by the initial template render. They will be processed per-item at runtime.
      const escapedBody = escapeTemplateMarkers(body);
      let attrs = `data-ax-for="${innerPair.start.list.trim()}" data-ax-as="${innerPair.start.item.trim()}"`;
      if (innerPair.start.key) {
        attrs += ` data-ax-key="${innerPair.start.key.trim()}"`;
      }

      let replacement = `<template ${attrs}>${escapedBody}</template>`;
      if (innerEmpty) {
        const escapedEmptyBody = escapeTemplateMarkers(emptyBody);
        replacement += `<template data-ax-empty>${escapedEmptyBody}</template>`;
      }
      currentTemplate = currentTemplate.substring(0, startIdx) + replacement + currentTemplate.substring(endIdx);
    }

    return currentTemplate;
  }

  /**
   * Processes <@suspense> tags, converting them to DOM markers.
   * @param {string} template - The template string.
   * @returns {string} The processed template.
   * @private
   */
  processSuspense(template) {
    let currentTemplate = template;
    while (true) {
      const match = currentTemplate.match(/<@suspense>([\s\S]*?)<\/ ?@suspense>/i);
      if (!match) break;

      const fullMatch = match[0];
      const inner = match[1];

      // Extract <@fallback>
      let fallbackContent = '';
      let suspenseContent = inner;
      const fallbackMatch = inner.match(/<@fallback>([\s\S]*?)<\/ ?@fallback>/i);
      if (fallbackMatch) {
        fallbackContent = escapeTemplateMarkers(fallbackMatch[1]); // Escape fallback template logic
        suspenseContent = inner.replace(fallbackMatch[0], '');
      }

      const replacement = `<div data-ax-suspense="true"><template data-ax-fallback>${fallbackContent}</template>${suspenseContent}</div>`;
      currentTemplate = currentTemplate.replace(fullMatch, replacement);
    }
    return currentTemplate;
  }

  /**
   * Processes <@errorBoundary> tags, converting them to DOM markers.
   * @param {string} template - The template string.
   * @returns {string} The processed template.
   * @private
   */
  processErrorBoundary(template) {
    let currentTemplate = template;
    while (true) {
      const match = currentTemplate.match(/<@errorBoundary>([\s\S]*?)<\/ ?@errorBoundary>/i);
      if (!match) break;

      const fullMatch = match[0];
      const inner = match[1];

      // Extract <@fallback as="...">
      let fallbackContent = '';
      let errorAs = 'error';
      let boundaryContent = inner;
      const fallbackMatch = inner.match(/<@fallback(?:\s+as="([^"]*)")?>([\s\S]*?)<\/ ?@fallback>/i);
      if (fallbackMatch) {
        errorAs = fallbackMatch[1] || 'error';
        fallbackContent = escapeTemplateMarkers(fallbackMatch[2]); // Escape fallback logic
        boundaryContent = inner.replace(fallbackMatch[0], '');
      }

      const replacement = `<div data-ax-error-boundary="true" data-ax-error-as="${errorAs}"><template data-ax-error-fallback><div class="ax-error-boundary">${fallbackContent}</div></template>${boundaryContent}</div>`;
      currentTemplate = currentTemplate.replace(fullMatch, replacement);
    }
    return currentTemplate;
  }

  /**
   * Processes <@deadlock> tags, converting them to DOM boundary markers.
   * Supports attributes: name="...", maxDepth="...", action="abort|fallback|throw", isolated="true|false",
   * and optional inner <@fallback as="..."> tags for error recovery.
   * @param {string} template - The template string.
   * @param {string} [filePath] - The component file path for source location tracking.
   * @returns {string} The processed template.
   * @private
   */
  processDeadlock(template, filePath = '') {
    let currentTemplate = template;
    const deadlockRegex = /<@deadlock\b([^>]*)>((?:(?!<@deadlock\b)[\s\S])*?)<\/ ?@deadlock>/i;

    while (true) {
      const match = currentTemplate.match(deadlockRegex);
      if (!match) break;

      const fullMatch = match[0];
      const attrsStr = match[1] || '';
      const inner = match[2];

      const nameMatch = attrsStr.match(/\bname=["']([^"']*)["']/i);
      const name = nameMatch ? nameMatch[1].trim() : 'anonymous';

      const depthMatch = attrsStr.match(/\bmaxDepth=["']([^"']*)["']/i);
      const depthAttr = depthMatch ? ` data-ax-deadlock-depth="${depthMatch[1].trim()}"` : '';

      const actionMatch = attrsStr.match(/\baction=["']([^"']*)["']/i);
      const actionAttr = actionMatch ? ` data-ax-deadlock-action="${actionMatch[1].trim().toLowerCase()}"` : '';

      const isolatedMatch = attrsStr.match(/\bisolated=["']([^"']*)["']/i);
      const isolatedAttr = isolatedMatch ? ` data-ax-deadlock-isolated="${isolatedMatch[1].trim().toLowerCase()}"` : '';

      // Compute location if possible
      let locAttr = '';
      if (filePath) {
        const matchIdx = currentTemplate.indexOf(fullMatch);
        if (matchIdx !== -1) {
          const pos = getLineAndColumn(currentTemplate, matchIdx);
          locAttr = ` data-ax-deadlock-loc="${filePath}:${pos.line}:${pos.column}"`;
        }
      }




          // Extract <@fallback as="...">
      let fallbackContent = '';
      let errorAs = 'error';
      let boundaryContent = inner;
      const fallbackMatch = inner.match(/<@fallback(?:\s+as="([^"]*)")?>([\s\S]*?)<\/ ?@fallback>/i);
      if (fallbackMatch) {
        errorAs = fallbackMatch[1] || 'error';
        fallbackContent = escapeTemplateMarkers(fallbackMatch[2]);
        boundaryContent = inner.replace(fallbackMatch[0], '');
      }

      const fallbackTpl = fallbackMatch
        ? `<template data-ax-deadlock-fallback="true" data-ax-error-as="${errorAs}"><div class="ax-deadlock-fallback">${fallbackContent}</div></template>`
        : '';

      const replacement = `<div data-ax-deadlock="true" data-ax-deadlock-name="${name}"${depthAttr}${actionAttr}${isolatedAttr}${locAttr}>${fallbackTpl}${boundaryContent}</div>`;
      currentTemplate = currentTemplate.replace(fullMatch, replacement);
    }
    return currentTemplate;
  }

  /**
   * Processes <@defer> tags, converting them to DOM markers with templates for deferred loading.
   * Supports triggers via when="<trigger>" (idle, visible, interaction, timer, expression)
   * and optional <@placeholder> and <@loading> sub-tags.
   * @param {string} template - The template string.
   * @returns {string} The processed template.
   * @private
   */
  processDefer(template) {
    let currentTemplate = template;
    while (true) {
      const match = currentTemplate.match(/<@defer(?:\s+when=["']([^"']*)["'])?\s*>([\s\S]*?)<\/ ?@defer>/i);
      if (!match) break;

      const fullMatch = match[0];
      const whenCondition = (match[1] || 'idle').trim();
      const inner = match[2];

      let placeholderContent = '';
      let loadingContent = '';
      let deferredContent = inner;

      const placeholderMatch = inner.match(/<@placeholder>([\s\S]*?)<\/ ?@placeholder>/i);
      if (placeholderMatch) {
        placeholderContent = escapeTemplateMarkers(placeholderMatch[1]).trim();
        deferredContent = deferredContent.replace(placeholderMatch[0], '');
      }

      const loadingMatch = inner.match(/<@loading>([\s\S]*?)<\/ ?@loading>/i);
      if (loadingMatch) {
        loadingContent = escapeTemplateMarkers(loadingMatch[1]).trim();
        deferredContent = deferredContent.replace(loadingMatch[0], '');
      }

      deferredContent = escapeTemplateMarkers(deferredContent).trim();

      const placeholderTpl = placeholderContent ? `<template data-ax-defer-placeholder>${placeholderContent}</template>` : '';
      const loadingTpl = loadingContent ? `<template data-ax-defer-loading>${loadingContent}</template>` : '';
      const contentTpl = `<template data-ax-defer-content>${deferredContent}</template>`;

      const replacement = `<div data-ax-defer="true" data-ax-defer-when="${whenCondition}">${placeholderTpl}${loadingTpl}${contentTpl}</div>`;
      currentTemplate = currentTemplate.replace(fullMatch, replacement);
    }
    return currentTemplate;
  }

  /**
   * Processes component tags recursively to handle transclusion slots.
   * Maps `<CompName ...>...</CompName>` to `<div data-avenx-comp="CompName">...</div>`.
   * @param {string} template - The template string.
   * @returns {string} The processed template.
   */
  processComponentTags(template) {
    let currentTemplate = template;
    currentTemplate = this.processSlotProps(currentTemplate);
    currentTemplate = this.escapeScopedSlots(currentTemplate);

    while (true) {
      // Find the first occurrence of < followed by an uppercase letter
      const match = currentTemplate.match(/<([A-Z][a-zA-Z0-9]*)\b/);
      if (!match) {
        break;
      }

      const compName = match[1];
      const startIndex = match.index;

      // Find the end of this opening/self-closing tag
      let i = startIndex + 1 + compName.length;
      let inQuote = null;
      let isSelfClosing = false;
      let tagEndIndex = -1;

      while (i < currentTemplate.length) {
        const char = currentTemplate[i];
        if (inQuote) {
          if (char === inQuote) {
            inQuote = null;
          }
        } else if (char === '"' || char === "'") {
          inQuote = char;
        } else if (char === '>') {
          const trimmedBefore = currentTemplate.substring(startIndex + 1 + compName.length, i).trim();
          if (trimmedBefore.endsWith('/')) {
            isSelfClosing = true;
          }
          tagEndIndex = i + 1;
          break;
        }
        i++;
      }

      if (tagEndIndex === -1) {
        break;
      }

      let attrsStr = currentTemplate.substring(startIndex + 1 + compName.length, tagEndIndex - 1).trim();
      if (isSelfClosing && attrsStr.endsWith('/')) {
        attrsStr = attrsStr.slice(0, -1).trim();
      }

      let isExpr = '';
      const isDynamic = compName === 'Component';

      const props = [];
      const others = [];
      const attrs = parseAttributes(attrsStr);

      for (const [attrName, attrVal] of Object.entries(attrs)) {
        if (isDynamic && (attrName === 'is' || attrName === ':is')) {
          if (attrVal.startsWith('{{') && attrVal.endsWith('}}')) {
            isExpr = attrVal.slice(2, -2).trim();
          } else {
            isExpr = attrVal.trim();
          }
        } else if (attrName.startsWith('@')) {
          others.push(`${attrName}="${attrVal.replace(/"/g, '&quot;')}"`);
        } else {
          let propExpr;

          if (attrVal.startsWith('{{') && attrVal.endsWith('}}')) {
            propExpr = attrVal.slice(2, -2).trim();
          } else {
            const trimmed = attrVal.trim();

            if (
              trimmed === 'true' ||
              trimmed === 'false' ||
              trimmed === 'null' ||
              (trimmed !== '' && !isNaN(trimmed))
            ) {
              propExpr = trimmed;
            } else {
              propExpr = `'${trimmed.replace(/'/g, "\\'")}'`;
            }
          }

          props.push(`data-props-${attrName}="${propExpr}"`);
        }
      }

      const propsAttr = props.length > 0 ? ` ${props.join(' ')}` : '';
      const othersAttr = others.length > 0 ? ` ${others.join(' ')}` : '';

      const replacementTag = isDynamic
        ? `data-avenx-comp-dynamic="${isExpr}"`
        : `data-avenx-comp="${compName}"`;

      if (isSelfClosing) {
        const replacement = `<div ${replacementTag}${propsAttr}${othersAttr}></div>`;

        currentTemplate =
          currentTemplate.substring(0, startIndex) +
          replacement +
          currentTemplate.substring(tagEndIndex);
      } else {
        let searchIndex = tagEndIndex;
        let depth = 1;
        let closingTagIndex = -1;
        let closingTagLength = 0;

        while (searchIndex < currentTemplate.length) {
          const nextOpen = currentTemplate
            .substring(searchIndex)
            .match(new RegExp(`^<${compName}\\b`));

          const nextClose = currentTemplate
            .substring(searchIndex)
            .match(new RegExp(`^</\\s*${compName}\\s*>`));

          if (nextClose) {
            depth--;

            if (depth === 0) {
              closingTagIndex = searchIndex;
              closingTagLength = nextClose[0].length;
              break;
            }

            searchIndex += nextClose[0].length;
          } else if (nextOpen) {
            let tempIdx = searchIndex + nextOpen[0].length;
            let tempInQuote = null;
            let tempIsSelfClosing = false;

            while (tempIdx < currentTemplate.length) {
              const tc = currentTemplate[tempIdx];

              if (tempInQuote) {
                if (tc === tempInQuote) {
                  tempInQuote = null;
                }
              } else if (tc === '"' || tc === "'") {
                tempInQuote = tc;
              } else if (tc === '>') {
                const trimmedBefore = currentTemplate
                  .substring(searchIndex + nextOpen[0].length, tempIdx)
                  .trim();

                if (trimmedBefore.endsWith('/')) {
                  tempIsSelfClosing = true;
                }

                tempIdx++;
                break;
              }

              tempIdx++;
            }

            if (!tempIsSelfClosing) {
              depth++;
            }

            searchIndex = tempIdx;
          } else {
            searchIndex++;
          }
        }

        if (closingTagIndex === -1) {
          const replacement = `<div ${replacementTag}${propsAttr}${othersAttr}></div>`;

          currentTemplate =
            currentTemplate.substring(0, startIndex) +
            replacement +
            currentTemplate.substring(tagEndIndex);
        } else {
          const innerContent = currentTemplate.substring(
            tagEndIndex,
            closingTagIndex,
          );

          const processedInner = this.processComponentTags(innerContent);

          const replacement =
            `<div ${replacementTag}${propsAttr}${othersAttr}>` +
            `${processedInner}` +
            `</div>`;

          currentTemplate =
            currentTemplate.substring(0, startIndex) +
            replacement +
            currentTemplate.substring(closingTagIndex + closingTagLength);
        }
      }
    }

    return currentTemplate;
  }

  /**
   * Processes transition tags in the template.
   *
   * @param {string} template - The HTML template string.
   * @param {string} [filePath] - The component file path.
   * @returns {string} The processed template.
   */
  processTransitionTags(template, filePath) {
    try {
      const customVoidTags = [
        ...(this.customVoidTags || []),
        ...getCustomVoidTags(filePath),
      ];

      const nodes = parseHTML(template, customVoidTags);
      const processed = this.processTransitionTagsInTree(nodes);

      return serializeHTML(processed, customVoidTags);
    } catch (err) {
      logger.warn(
        new TemplateValidationError(
          AvenxErrorCodes.COMPILER_TRANSITION_PARSE_FAILED,
          err,
        ).message,
      );

      return template;
    }
  }

  /**
   * Recursively processes transition tags in the node tree.
   *
   * @param {HTMLNode[]} nodes
   * @returns {HTMLNode[]}
   */
  processTransitionTagsInTree(nodes) {
    const result = [];

    for (const node of nodes) {
      if (node.type === 'element') {
        if (node.tagName.toLowerCase() === 'transition') {
          const nameAttr = node.attrs['name'];

          let transitionValue = "'ax'";

          if (nameAttr) {
            if (
              nameAttr.startsWith('{{') &&
              nameAttr.endsWith('}}')
            ) {
              transitionValue = nameAttr.slice(2, -2).trim();
            } else {
              transitionValue = `'${nameAttr.replace(/'/g, "\\'")}'`;
            }
          }

          const processedChildren =
            this.processTransitionTagsInTree(node.children);

          for (const child of processedChildren) {
            if (child.type === 'element') {
              child.attrs['data-ax-transition'] = transitionValue;
            }

            result.push(child);
          }
        } else {
          node.children = this.processTransitionTagsInTree(node.children);
          result.push(node);
        }
      } else {
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Identifies static elements/subtrees and marks them with data-ax-static="true".
   *
   * @param {string} template - The compiled HTML template.
   * @param {string} [filePath] - The component file path.
   * @returns {string} The optimized template.
   */
  optimizeStaticSubtrees(template, filePath) {
    try {
      const customVoidTags = [
        ...(this.customVoidTags || []),
        ...getCustomVoidTags(filePath),
      ];

      const nodes = parseHTML(template, customVoidTags);

      this.markStaticNodes(nodes, false);

      return serializeHTML(nodes, customVoidTags);
    } catch (err) {
      logger.warn(
        new TemplateValidationError(
          AvenxErrorCodes.COMPILER_STATIC_SUBTREE_OPTIMIZATION_FAILED,
          err,
        ).message,
      );

      return template;
    }
  }

  /**
   * Recursively traverses nodes to find and mark the root of static subtrees.
   *
   * @param {HTMLNode[]} nodes
   * @param {boolean} [parentIsStatic]
   * @param {boolean} [inSlot]
   */
  markStaticNodes(nodes, parentIsStatic = false, inSlot = false) {
    for (const node of nodes) {
      if (node.type !== 'element') {
        continue;
      }

      const lowerTag = node.tagName.toLowerCase();
      const isSlot = lowerTag === 'slot';

      const isComponent = Boolean(
        node.attrs['data-avenx-comp'] ||
        node.attrs['data-ax-comp'] ||
        /^[A-Z]/.test(node.tagName),
      );

      const currentInSlot =
        inSlot ||
        isSlot ||
        isComponent;

      const hasStaticContract =
        node.contracts &&
        node.contracts.has('static');

      const nodeStatic =
        !currentInSlot &&
        (hasStaticContract || isStaticNode(node));

      if (lowerTag === '@static') {
        node.tagName = 'div';
        node.attrs['data-ax-static'] = 'true';
      } else if (lowerTag === '@isolated') {
        node.tagName = 'div';
        node.attrs['data-ax-isolated'] = 'true';
      } else if (lowerTag === '@pure') {
        node.tagName = 'div';
        node.attrs['data-ax-pure'] = 'true';
      } else if (lowerTag === '@deterministic') {
        node.tagName = 'div';
        node.attrs['data-ax-deterministic'] = 'true';
      }

      if (node.attrs) {
        if (node.attrs['static'] !== undefined) {
          delete node.attrs['static'];
        }

        if (node.attrs['pure'] !== undefined) {
          delete node.attrs['pure'];
        }

        if (node.attrs['deterministic'] !== undefined) {
          delete node.attrs['deterministic'];
        }

        if (node.attrs['isolated'] !== undefined) {
          delete node.attrs['isolated'];
        }
      }

      if (
        node.contracts &&
        node.contracts.has('pure') &&
        node.contracts.has('deterministic') &&
        !nodeStatic
      ) {
        node.attrs['data-ax-memo'] = 'true';
      }

      if (nodeStatic && !parentIsStatic) {
        node.attrs['data-ax-static'] = 'true';
      }

      this.markStaticNodes(
        node.children,
        nodeStatic,
        currentInSlot,
      );
    }
  }
}

/**
 * Parses an HTML string into a tree of HTMLNode elements.
 *
 * @param {string} html
 * @param {string[]} [customVoidTags]
 * @returns {HTMLNode[]}
 */

/**
 * Recursively checks whether a node is a <slot> tag, or has a <slot>
 * anywhere among its descendants.
 *
 * @param {HTMLNode} node
 * @returns {boolean}
 */
function containsSlot(node) {
  if (node.type !== 'element') {
    return false;
  }

  if (node.tagName.toLowerCase() === 'slot') {
    return true;
  }

  return node.children.some((child) => containsSlot(child));
}

/**
 * Recursively determines if a node (and all its descendants) are completely static.
 *
 * @param {HTMLNode} node
 * @returns {boolean}
 */
function isStaticNode(node) {
  if (node.type === 'text') {
    if (
      node.content.includes('{{') ||
      node.content.includes('{%')
    ) {
      return false;
    }

    return true;
  }

  if (node.type === 'comment') {
    return true;
  }

  if (node.type === 'element') {
    const lowerTag = node.tagName.toLowerCase();

    if (
      lowerTag === 'template' ||
      lowerTag === 'slot'
    ) {
      return false;
    }

    if (lowerTag.startsWith('@')) {
      return false;
    }

    if (containsSlot(node)) {
      return false;
    }

    if (/^[A-Z]/.test(node.tagName)) {
      return false;
    }

    for (const [name, val] of Object.entries(node.attrs)) {
      if (
        name.startsWith('@') ||
        name.startsWith(':[')
      ) {
        return false;
      }

      if (
        name.startsWith('data-ax-') &&
        name !== 'data-ax-static'
      ) {
        return false;
      }

      if (name.startsWith('data-avenx-')) {
        return false;
      }

      if (
        val &&
        (
          val.includes('{{') ||
          val.includes('{%')
        )
      ) {
        return false;
      }
    }

    for (const child of node.children) {
      if (!isStaticNode(child)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

ComponentParser.parseHTML = parseHTML;

export default ComponentParser;
