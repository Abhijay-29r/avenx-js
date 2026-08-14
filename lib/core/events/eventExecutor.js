import { AvenxSandbox } from '../security/sandbox.js';
import { logger } from '../runtime/AvenxLogger.js';
import { AvenxErrorCodes, formatMessage } from '../runtime/AvenxError.js';

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

    try {
      let fn = this.#compiledHandlerCache.get(source);
      if (!fn) {
        AvenxSandbox.validateSource(source);
        const originalFn = new Function('state', 'methods', 'event', 'args', `with(state) { with(methods) { ${source} } }`);
        
        fn = function(state, methods, evt, args) {
          try {
            return originalFn(state, methods, evt, args);
          } catch (err) {
            const elTag = evt?.target?.tagName || 'UNKNOWN';
            const eType = evt?.type || 'unknown';
            /**
             * Error wrapper for event execution failures.
             * @private
             */
            class AvenxEventExecutionError extends Error {
              /**
               * @param {Error} originalError - The original error thrown during execution
               * @param {string} elTag - The element tag name
               * @param {string} eType - The event type
               */
              constructor(originalError, elTag, eType) {
                super(originalError.message || String(originalError));
                this.name = originalError.name || 'Error';
                this.cause = originalError;
                this.stack = originalError.stack;
                this.elTag = elTag;
                this.eType = eType;
              }
              /**
               * Returns a formatted error message with context
               * @returns {string} Formatted error string
               */
              toString() {
                return `${this.name}: ${this.message} \n[Context] Element: <${this.elTag}>, Event: '${this.eType}'`;
              }
            }

            throw new AvenxEventExecutionError(err, elTag, eType);
          }
        };
        
        fn.source = source;
        this.#compiledHandlerCache.set(source, fn);
      }

      return this.runHandler(fn, event, slotScope);
    } catch (error) {
      const compContext = event?.target?.__avenx_comp_instance?.$logContext || {};
      const elTag = event?.target?.tagName || 'UNKNOWN';
      const eType = event?.type || 'unknown';
      const msg = formatMessage(AvenxErrorCodes.EVENT_HANDLER_ERROR, source, error);
      const extendedMsg = `${msg} \n[Context] Element: <${elTag}>, Event: '${eType}'`;
      logger.error(extendedMsg, compContext);
      throw error;
    }
  }

  /**
   * Cleans up the run handler closure reference to prevent parent scope memory retention.
   */
  teardown() {
    this.runHandler = null;
    this.#compiledHandlerCache.clear();
  }
}
