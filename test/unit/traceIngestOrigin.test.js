/**
 * @file traceIngestOrigin.test.js
 * @description The dev server refuses a cross-origin trace upload.
 *
 * `avenx serve --trace` accepts a POST that writes a trace file, which
 * `avenx trace export` later turns into JavaScript. Without an origin check,
 * any page the developer visits while the server runs could plant one.
 */
import assert from 'node:assert';
import { isSameOriginRequest } from '../../bin/commands/serve.js';

/**
 * Builds a request-like object with the given headers.
 * @param {object} headers - Request headers.
 * @returns {object} A request stub.
 */
const req = (headers) => ({ headers });

try {
  console.log('🧪 Same-origin and header-less requests are accepted');
  assert.strictEqual(isSameOriginRequest(req({ host: 'localhost:3000' })), true, 'no Origin header');
  assert.strictEqual(
    isSameOriginRequest(req({ host: 'localhost:3000', origin: 'http://localhost:3000' })),
    true,
    'matching origin',
  );
  assert.strictEqual(
    isSameOriginRequest(req({ host: '127.0.0.1:5173', origin: 'https://127.0.0.1:5173' })),
    true,
    'matching host with another scheme is still the same host',
  );

  console.log('🧪 Cross-origin uploads are refused');
  for (const origin of [
    'https://evil.example',
    'http://localhost:3001',
    'http://localhost.evil.example',
    // An opaque origin: a sandboxed iframe or a data: URL, which is what an
    // attacker page would present.
    'null',
  ]) {
    assert.strictEqual(isSameOriginRequest(req({ host: 'localhost:3000', origin })), false, `origin ${origin}`);
  }
  assert.strictEqual(isSameOriginRequest(req({ origin: 'https://evil.example' })), false, 'no host to compare');
  assert.strictEqual(isSameOriginRequest(req({ host: 'localhost:3000', origin: 'not a url' })), false, 'malformed');

  console.log('  ✅ Trace ingest origin tests passed!');
} catch (error) {
  console.error('❌ Trace ingest origin tests failed:', error);
  process.exitCode = 1;
}
