import { AvenxSandbox } from './sandbox.js';
import { Sanitizer } from './sanitize.js';
import { tracer } from '../trace/tracer.js';
import { TraceNodeType } from '../trace/schema.js';

/**
 * Provides dynamic expression and statement evaluation within a given scope.
 */
export class DynamicEvaluator {
  /**
   * Evaluates a JavaScript expression within a scope.
   * @param {string} expression - The expression to evaluate.
   * @param {object} [scope] - The scope variables.
   * @param {object} [thisArg] - The 'this' context for evaluation.
   * @returns {any} The result of evaluation.
   */
  evaluateExpression(expression, scope = {}, thisArg = scope) {
    AvenxSandbox.validateSource(expression);
    const sandbox = AvenxSandbox.createProxy(scope, thisArg);
    const fn = new Function(`with(this) { return (${expression}) }`);
    return fn.call(sandbox);
  }

  /**
   * Executes a JavaScript statement within a scope.
   * @param {string} source - The statement(s) to execute.
   * @param {object} [scope] - The scope variables.
   * @param {object} [thisArg] - The 'this' context for execution.
   * @returns {any} The result of execution.
   */
  executeStatement(source, scope = {}, thisArg = scope) {
    AvenxSandbox.validateSource(source);
    const sandbox = AvenxSandbox.createProxy(scope, thisArg);
    const fn = new Function(`with(this) { ${source} }`);
    return fn.call(sandbox);
  }

  /**
   * Creates a map of executable methods from string definitions.
   * @param {object} [methods] - An object containing method name and source code pairs.
   * @param {function(object): object} getScope - Function to retrieve the scope for a method.
   * @param {function(): object} getThisArg - Function to retrieve the 'this' context for methods.
   * @param {object} [context] - Trace context describing who owns these methods.
   * @param {string} [context.owner] - The component or page name, used in traces.
   * @param {string} [context.kind] - What sort of unit these are, e.g. `action` or `resource`.
   * @returns {object} A map of functions.
   */
  createMethodMap(methods = {}, getScope, getThisArg, context = null) {
    const executable = {};
    const owner = context && context.owner;
    const kind = (context && context.kind) || 'action';

    for (const [name, source] of Object.entries(methods)) {
      if (typeof source === 'function') {
        executable[name] = source.bind(getThisArg());
      } else {
        executable[name] = (...args) => {
          const run = () => this.executeStatement(source, { ...getScope(executable), args }, getThisArg());
          if (!tracer.on) {
            return run();
          }
          // The action's own source is recorded. Because Avenx executes action
          // bodies as text rather than compiling them away, a trace can show
          // the code that ran instead of an opaque function reference.
          const token = tracer.enter(TraceNodeType.ACTION, {
            name,
            kind,
            component: owner,
            source,
            args: args.length > 0 ? tracer.sink.capture(args, `${name}.args`) : undefined,
          });
          try {
            return run();
          } finally {
            tracer.leave(token);
          }
        };
      }
    }

    return executable;
  }

  /**
   * Sanitizes an HTML string using the Sanitizer utility with optional custom policy configuration.
   * @param {any} value - The HTML string or value to sanitize.
   * @param {object} [options] - Optional custom policy configuration for Sanitizer.
   * @returns {string} The sanitized HTML string.
   */
  sanitizeHTML(value, options = {}) {
    const sanitizer = new Sanitizer(options);
    return sanitizer.sanitize(value);
  }
}
