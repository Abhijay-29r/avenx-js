/**
 * @file watcher.js
 * @description General-purpose state watcher and reactivity dependency tracking for Avenx-JS.
 */

/**
 * WeakMap tracking raw target to Map of keys to Set of active Watchers depending on them.
 * @type {WeakMap<object, Map<string, Set<AvenxWatcher>>>}
 */
export const depMap = new WeakMap();

/**
 * WeakMap tracking nested child targets to their parent relationship.
 * @type {WeakMap<object, {parentTarget: object, parentKey: string}>}
 */
export const parentMap = new WeakMap();

/**
 * The currently active watcher evaluating a reactive expression/function.
 * @type {AvenxWatcher|null}
 */
export let activeWatcher = null;

/**
 * Call stack of active watchers.
 * @type {AvenxWatcher[]}
 */
const watcherStack = [];

/**
 * Pushes a watcher onto the active evaluation context stack.
 * @param {AvenxWatcher} watcher - The watcher instance to run.
 */
export function pushWatcher(watcher) {
  watcherStack.push(activeWatcher);
  activeWatcher = watcher;
}

/**
 * Pops the active watcher context from the stack.
 */
export function popWatcher() {
  activeWatcher = watcherStack.pop();
}

let debugReactivity = false;

/**
 * Programmatically enables or disables debug reactivity logging.
 * @param {boolean} enabled
 */
export function setDebugReactivity(enabled) {
  debugReactivity = Boolean(enabled);
}

/**
 * Returns whether debug reactivity logging is currently enabled.
 * @returns {boolean}
 */
export function isDebugReactivityEnabled() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.__avenx_debug_reactivity__ === 'boolean') {
    return globalThis.__avenx_debug_reactivity__;
  }
  return debugReactivity;
}

/**
 * Formats a value for debug logging output.
 * @param {any} val
 * @returns {string}
 */
export function formatValue(val) {
  if (typeof val === 'string') {
    return `"${val}"`;
  }
  if (val === undefined) {
    return 'undefined';
  }
  if (val === null) {
    return 'null';
  }
  if (typeof val === 'symbol') {
    return val.toString();
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

/**
 * Constructs the full property path from a target object and key using parentMap.
 * @param {object} target
 * @param {string|symbol} key
 * @returns {string}
 */
export function getPropertyPath(target, key) {
  const parts = [];
  if (key !== undefined && key !== null) {
    parts.unshift(String(key));
  }
  let current = target;
  while (current) {
    const relation = parentMap.get(current);
    if (!relation) break;
    parts.unshift(String(relation.parentKey));
    current = relation.parentTarget;
  }
  return parts.join('.');
}

/**
 * Tracks a property access on a target, establishing a dependency relationship.
 * @param {object} target - The raw reactive target object.
 * @param {string} key - The property key accessed.
 */
export function track(target, key) {
  if (activeWatcher) {
    let keysMap = depMap.get(target);
    if (!keysMap) {
      keysMap = new Map();
      depMap.set(target, keysMap);
    }
    let watchers = keysMap.get(key);
    if (!watchers) {
      watchers = new Set();
      keysMap.set(key, watchers);
    }
    watchers.add(activeWatcher);
    activeWatcher.addDep(target, key, watchers);

    if (isDebugReactivityEnabled()) {
      const propPath = getPropertyPath(target, key);
      const watcherName = activeWatcher.name || (activeWatcher.options && activeWatcher.options.name) || 'anonymous';
      console.log(`[Avenx Debug] Tracked property "${propPath}" by Watcher "${watcherName}"`);
    }
  }
}

let triggerDepth = 0;
const triggeredWatchers = new Set();

/**
 * Triggers all watchers registered to a mutated property, and propagates to parent nodes.
 * @param {object} target - The raw target where mutation occurred.
 * @param {string} key - The property key mutated.
 * @param {any} [oldValue] - Previous value before mutation.
 * @param {any} [newValue] - New value after mutation.
 */
export function trigger(target, key, oldValue, newValue) {
  if (triggerDepth === 0) {
    triggeredWatchers.clear();
  }
  triggerDepth++;

  try {
    const keys = Array.isArray(key) ? key : [key];

    if (isDebugReactivityEnabled()) {
      for (const k of keys) {
        if (typeof k !== 'symbol') {
          const propPath = getPropertyPath(target, k);
          const oldFormatted = formatValue(oldValue);
          const newFormatted = formatValue(newValue);
          console.log(`[Avenx Debug] Triggered property "${propPath}" (old: ${oldFormatted}, new: ${newFormatted}) -> scheduling update`);
        }
      }
    }

    const keysMap = depMap.get(target);
    if (keysMap) {
      for (const k of keys) {
        const watchers = keysMap.get(k);
        if (watchers) {
          // Copy to prevent concurrent modification issues during execution
          const toRun = new Set(watchers);
          for (const watcher of toRun) {
            if (!triggeredWatchers.has(watcher)) {
              triggeredWatchers.add(watcher);
              if (typeof watcher.update === 'function') {
                watcher.update();
              }
            }
          }
        }
      }
    }

    // Propagate triggering to parents in case target is a nested object
    const parentRelation = parentMap.get(target);
    if (parentRelation) {
      const { parentTarget, parentKey } = parentRelation;
      trigger(parentTarget, parentKey, oldValue, newValue);
    }
  } finally {
    triggerDepth--;
  }
}

/**
 * Recursively traverses a reactive value to register deep dependencies.
 * @param {any} value
 * @param {Set<any>} [seen]
 */
function traverse(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else {
    for (const key of Object.keys(value)) {
      traverse(value[key], seen);
    }
  }
}

/**
 * AvenxWatcher handles dependency tracking, caching, lazy/immediate callbacks,
 * and lifecycle cleanup for reactive expressions.
 */
export class AvenxWatcher {
  /**
   * @param {function(): any} getter - The reactive evaluation function.
   * @param {function(any, any): void|null} [callback] - Callback triggered when evaluated value changes.
   * @param {object} [options] - Configuration options.
   * @param {boolean} [options.immediate] - Run the callback immediately with initial value.
   * @param {boolean} [options.lazy] - Postpone the initial evaluation until first accessed.
   */
  constructor(getter, callback = null, options = {}) {
    /** @type {function(): any} */
    this.getter = getter;
    /** @type {function(any, any): void|null} */
    this.callback = callback;
    /** @type {object} */
    this.options = options;
    /** @type {string} */
    this.name = (options && (options.name || options.id)) || (getter && getter.name) || 'anonymous';
    /** @type {Set<{target: object, key: string, watchersSet: Set<AvenxWatcher>}>} */
    this.deps = new Set();
    /** @type {boolean} */
    this.dirty = true;
    /** @type {any} */
    this.value = undefined;

    if (!options.lazy) {
      this.value = this.get();
      this.dirty = false;
    }

    if (options.immediate && this.callback) {
      this.callback(this.value, undefined);
    }
  }

  /**
   * Evaluates the getter function inside the watcher context to track reactive dependencies.
   * @returns {any}
   */
  get() {
    pushWatcher(this);
    const oldDeps = this.deps;
    this.deps = new Set();

    try {
      const value = this.getter();
      if (this.options.deep) {
        traverse(value);
      }
      this.cleanupDeps(oldDeps);
      return value;
    } catch (err) {
      this.deps = oldDeps;
      throw err;
    } finally {
      popWatcher();
    }
  }

  /**
   * Evaluates a lazy computed watcher if it is dirty.
   * @returns {any}
   */
  evaluate() {
    if (this.dirty) {
      this.value = this.get();
      this.dirty = false;
    }
    return this.value;
  }

  /**
   * Registers a target property dependency on this watcher.
   * @param {object} target - Reactive object target.
   * @param {string} key - Property key.
   * @param {Set<AvenxWatcher>} watchersSet - Set mapping to this dependency.
   */
  addDep(target, key, watchersSet) {
    for (const dep of this.deps) {
      if (dep.watchersSet === watchersSet) {
        return;
      }
    }
    this.deps.add({ target, key, watchersSet });
  }

  /**
   * Compares active dependencies against old dependencies and unsubscribes from stale dependencies.
   * @param {Set<{target: object, key: string, watchersSet: Set<AvenxWatcher>}>} oldDeps
   */
  cleanupDeps(oldDeps) {
    const activeWatcherSets = new Set();
    for (const dep of this.deps) {
      activeWatcherSets.add(dep.watchersSet);
    }
    for (const oldDep of oldDeps) {
      if (!activeWatcherSets.has(oldDep.watchersSet)) {
        oldDep.watchersSet.delete(this);
      }
    }
  }

  /**
   * Triggers re-evaluation when a tracked dependency changes, firing the callback if needed.
   */
  update() {
    if (this.options.lazy) {
      this.dirty = true;
      if (this.callback) {
        this.callback(this.value, this.value);
      }
    } else {
      const oldValue = this.value;
      const newValue = this.get();
      if (newValue !== oldValue || (newValue && typeof newValue === 'object')) {
        this.value = newValue;
        if (this.callback) {
          this.callback(newValue, oldValue);
        }
      }
    }
  }

  /**
   * Cleans up all registered dependencies of this watcher to prevent memory leaks.
   */
  teardown() {
    for (const dep of this.deps) {
      dep.watchersSet.delete(this);
    }
    this.deps.clear();
  }
}
