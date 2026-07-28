import { AvenxSandbox } from '../security/sandbox.js';

/**
 * Handles the execution of event handlers.
 */
export class EventExecutor {
  /**
   * @type {Map<string, Function>}
   * @private
   */
  #compiledHandlerCache = new Map();

  /**
   * @param {function(Function | string, Event|null): any} runHandler - Function that executes the event logic.
   */
  constructor(runHandler) {
    /**
     * @type {function(Function | string, Event|null): any}
     */
    this.runHandler = runHandler;
  }

  /**
   * Executes the event handler for a given source.
   * @param {string} source - The source code or identifier for the event handler.
   * @param {Event|null} [event] - The event object, if any.
   * @param {object|null} [slotScope] - The slot scope context, if any.
   * @returns {any} The result of the event handler execution.
   */
  execute(source, event = null, slotScope = null) {
    if (!this.runHandler) {
      throw new TypeError('Handler is not configured or has been torn down.');
    }

    let fn = this.#compiledHandlerCache.get(source);
    if (!fn) {
      AvenxSandbox.validateSource(source);
      fn = new Function('state', 'methods', 'event', 'args', `with(state) { with(methods) { ${source} } }`);
      fn.source = source;
      this.#compiledHandlerCache.set(source, fn);
    }

    return this.runHandler(fn, event, slotScope);
  }

  /**
   * Cleans up the run handler closure reference to prevent parent scope memory retention.
   */
  teardown() {
    this.runHandler = null;
    this.#compiledHandlerCache.clear();
  }
}
