/**
 * Avenx testing utilities.
 *
 * These helpers drive components outside a browser: a DOM mock, a component
 * sandbox and the async flush helpers a test needs. They are deliberately kept
 * out of `lib/core/index.js` so that nothing here can reach a production
 * bundle — the runtime entry is the only module the browser build sees.
 * @module lib/core/testing
 */

export { AvenxMock, AvenxSandbox, mountTestComponent, fireEvent, flushPromises } from './runtime/AvenxMock.js';
