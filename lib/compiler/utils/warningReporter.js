import { logger } from '../../core/runtime/AvenxLogger.js';
import { BuildError } from '../errors/BuildError.js';
import { formatCodeFrame } from '../errors/CompilerError.js';

/**
 * Reports a compiler warning according to configured warning severities.
 * @param {string} code - Avenx error/warning code (e.g. 'AVX_W03').
 * @param {string|Error} errOrMessage - An Error object or formatted warning message string.
 * @param {object} [config] - The application configuration object containing `warnings` overrides.
 * @param {object} [location] - Location metadata { line, column, source, filename, index, length }.
 */
export function reportWarning(code, errOrMessage, config = {}, location = null) {
  const warnings = (config && config.warnings) || {};
  const rawSeverity = warnings[code];
  const severity = typeof rawSeverity === 'string' ? rawSeverity.trim().toLowerCase() : 'warn';

  if (severity === 'off' || severity === 'ignore') {
    return;
  }

  let errorObj = null;
  if (errOrMessage instanceof Error) {
    errorObj = errOrMessage;
    if (location && typeof errorObj.setLocation === 'function' && !errorObj.frame) {
      errorObj.setLocation(location);
    }
  }

  let message = String(errOrMessage);
  if (errorObj && errorObj.message) {
    message = errorObj.message;
  } else if (typeof errOrMessage === 'string') {
    message = errOrMessage;
    if (location && location.source && location.line && location.column) {
      const frame = formatCodeFrame(location.source, location.line, location.column, location);
      if (frame && !message.includes(frame)) {
        message += `\n\n${frame}`;
      }
    }
  }

  if (severity === 'error') {
    if (errorObj) {
      throw errorObj;
    }
    const buildErr = new BuildError(code, message);
    if (location) {
      buildErr.setLocation(location);
    }
    throw buildErr;
  }

  logger.warn(message);
}

export default reportWarning;

