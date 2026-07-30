import { logger } from '../../core/runtime/AvenxLogger.js';
import { BuildError } from '../errors/BuildError.js';

/**
 * Reports a compiler warning according to configured warning severities.
 * @param {string} code - Avenx error/warning code (e.g. 'AVX_W03').
 * @param {string|Error} errOrMessage - An Error object or formatted warning message string.
 * @param {object} [config] - The application configuration object containing `warnings` overrides.
 */
export function reportWarning(code, errOrMessage, config = {}) {
  const warnings = (config && config.warnings) || {};
  const rawSeverity = warnings[code];
  const severity = typeof rawSeverity === 'string' ? rawSeverity.trim().toLowerCase() : 'warn';

  if (severity === 'off' || severity === 'ignore') {
    return;
  }

  let message = String(errOrMessage);
  if (typeof errOrMessage === 'string') {
    message = errOrMessage;
  } else if (errOrMessage && errOrMessage.message) {
    message = errOrMessage.message;
  }

  if (severity === 'error') {
    if (errOrMessage instanceof Error) {
      throw errOrMessage;
    }
    throw new BuildError(code, message);
  }

  logger.warn(message);
}

export default reportWarning;
