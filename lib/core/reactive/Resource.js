import { AvenxWatcher } from './watcher.js';

/**
 * A reactive resource that evaluates a handler function asynchronously.
 * Supports Suspense and Error Boundaries by throwing Promises/Errors during render.
 */
export class Resource {
  /**
   * @param {string} name - Resource name.
   * @param {function(): any} handlerFn - The function to execute (e.g., fetch call).
   * @param {object} [componentContext] - The component instance context.
   * @param {object} [options] - Resource options (e.g., pollInterval).
   */
  constructor(name, handlerFn, componentContext, options = {}) {
    this.name = name;
    this.handlerFn = handlerFn;

    let ctx = componentContext;
    let opts = options;
    if (
      componentContext &&
      typeof componentContext === 'object' &&
      !('renderWatcher' in componentContext || 'update' in componentContext || '$app' in componentContext || 'state' in componentContext) &&
      'pollInterval' in componentContext
    ) {
      opts = componentContext;
      ctx = null;
    }

    this.componentContext = ctx || null;
    this.options = opts || {};

    this.status = 'idle'; // 'idle' | 'pending' | 'resolved' | 'rejected'
    this.value = undefined;
    this.error = undefined;
    this.promise = null;
    this.pollTimer = null;
    this.pollInterval = this.options.pollInterval ? Number(this.options.pollInterval) : 0;

    // Create a watcher that triggers fetch() when dependencies change.
    this.watcher = new AvenxWatcher(
      () => {
        // Evaluate the handler in the component context to track dependencies
        return this.handlerFn.call(this.componentContext);
      },
      (newVal) => {
        // Callback when reactive dependencies change -> re-fetch
        this.fetch(newVal);
      },
      { name: `Resource#${name}` }
    );

    // Initiate the first fetch manually with the initial evaluated value
    this.fetch(this.watcher.value);

    if (this.pollInterval > 0) {
      this.pollTimer = setInterval(() => {
        const val = typeof this.watcher.get === 'function' ? this.watcher.get() : this.watcher.value;
        this.fetch(val);
      }, this.pollInterval);
    }
  }

  /**
   * Evaluates the resource result and updates internal state.
   * @param {any} result - The result from the watcher getter (could be a Promise).
   * @private
   */
  fetch(result) {
    this.status = 'pending';
    this.error = undefined;

    if (result && typeof result.then === 'function') {
      this.promise = result.then(
        (val) => {
          this.status = 'resolved';
          this.value = val;
          if (this.componentContext) {
            if (this.componentContext.renderWatcher) {
              this.componentContext.renderWatcher.dirty = true;
            }
            if (typeof this.componentContext.update === 'function') {
              this.componentContext.update();
            }
          }
          return val;
        },
        (err) => {
          this.status = 'rejected';
          this.error = err;
          if (this.componentContext) {
            if (this.componentContext.renderWatcher) {
              this.componentContext.renderWatcher.dirty = true;
            }
            if (typeof this.componentContext.update === 'function') {
              this.componentContext.update();
            }
          }
        }
      );
    } else {
      // Synchronous result
      this.status = 'resolved';
      this.value = result;
      this.promise = Promise.resolve(result);
    }
  }

  /**
   * Reads the resource value.
   * Throws Promise if pending (Suspense).
   * Throws Error if rejected (ErrorBoundary).
   * Returns value if resolved.
   * @returns {any}
   */
  read() {
    if (this.status === 'pending' && this.promise) {
      throw this.promise;
    }
    if (this.status === 'rejected') {
      throw this.error;
    }
    return this.value;
  }

  /**
   * Cleans up the resource watcher and polling timer.
   */
  teardown() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.watcher) {
      this.watcher.teardown();
    }
  }
}
