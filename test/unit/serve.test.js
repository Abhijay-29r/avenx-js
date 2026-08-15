import assert from 'assert';
import { EventEmitter } from 'events';
import { listenWithPortFallback, formatStatusCode, formatRequestLog, attachRequestLogger } from '../../bin/commands/serve.js';
import { setColorEnabled } from '../../bin/colors.js';
import { AvenxCLI } from '../../bin/cli.js';

class OccupiedPortServer extends EventEmitter {
  constructor() {
    super();
    this.attempts = [];
  }

  listen(port, host) {
    this.attempts.push({ port, host });
    if (this.attempts.length === 1) {
      const error = new Error('address already in use');
      error.code = 'EADDRINUSE';
      this.emit('error', error);
    } else {
      this.emit('listening');
    }
  }
}

function runTests() {
  const server = new OccupiedPortServer();
  const warnings = [];
  const originalWarn = console.warn;
  let activePort;

  try {
    console.warn = (message) => warnings.push(message);
    listenWithPortFallback(server, 3000, 'localhost', (port) => {
      activePort = port;
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepStrictEqual(server.attempts, [
    { port: 3000, host: 'localhost' },
    { port: 3001, host: 'localhost' },
  ]);
  assert.strictEqual(activePort, 3001);
  assert.strictEqual(warnings.length, 1);
  assert.ok(warnings[0].includes('Port 3000 is already in use'));
  assert.ok(warnings[0].includes('Trying 3001'));
}

async function testCliServeParsing() {
  let lastCall = null;
  class TestCLI extends AvenxCLI {
    serveProject(port, host) {
      lastCall = { port, host };
    }
  }

  const cli = new TestCLI();

  // Test --port 3000/
  await cli.run('serve', ['--port', '3000/']);
  assert.deepStrictEqual(lastCall, { port: 3000, host: 'localhost' });

  // Test --host localhost/
  await cli.run('serve', ['--host', 'localhost/']);
  assert.deepStrictEqual(lastCall, { port: 3000, host: 'localhost' });

  // Test trailing slashes and accidental whitespace
  await cli.run('serve', ['--port', ' 3000/ ', '--host', ' 127.0.0.1/ ']);
  assert.deepStrictEqual(lastCall, { port: 3000, host: '127.0.0.1' });

  // Test positional port 3000/
  await cli.run('serve', ['3000/']);
  assert.deepStrictEqual(lastCall, { port: 3000, host: 'localhost' });

  // Test flag assignments --port=8080/ --host=localhost/
  await cli.run('serve', ['--port=8080/', '--host=localhost/']);
  assert.deepStrictEqual(lastCall, { port: 8080, host: 'localhost' });
}

function testRequestLoggerFormatting() {
  setColorEnabled(false);
  const testDate = new Date();
  testDate.setHours(14, 23, 5);

  const log200 = formatRequestLog('GET', '/src/main.app.js', 200, 2.4, testDate);
  assert.strictEqual(log200, '[14:23:05] GET /src/main.app.js - 200 (2.4ms)');

  const testDate404 = new Date(testDate);
  testDate404.setHours(14, 23, 6);
  const log404 = formatRequestLog('GET', '/favicon.ico', 404, 1.1, testDate404);
  assert.strictEqual(log404, '[14:23:06] GET /favicon.ico - 404 (1.1ms)');

  setColorEnabled(true);
  const status200 = formatStatusCode(200);
  assert.ok(status200.includes('\x1b[32m200\x1b[39m'), '200 should be green in ANSI');

  const status304 = formatStatusCode(304);
  assert.ok(status304.includes('\x1b[33m304\x1b[39m'), '304 should be yellow in ANSI');

  const status404 = formatStatusCode(404);
  assert.ok(status404.includes('\x1b[31m404\x1b[39m'), '404 should be red in ANSI');

  const status500 = formatStatusCode(500);
  assert.ok(status500.includes('\x1b[31m500\x1b[39m'), '500 should be red in ANSI');
}

function testAttachRequestLogger() {
  setColorEnabled(false);
  const logs = [];
  const mockReq = { method: 'GET', url: '/src/main.app.js' };
  const mockRes = new EventEmitter();
  mockRes.statusCode = 200;

  attachRequestLogger(mockReq, mockRes, (log) => logs.push(log));

  mockRes.emit('finish');
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].includes('GET /src/main.app.js - 200'));

  // Ensure double emit finish does not duplicate log
  mockRes.emit('finish');
  assert.strictEqual(logs.length, 1);
}

try {
  testRequestLoggerFormatting();
  testAttachRequestLogger();
  runTests();
  await testCliServeParsing();
  console.log('Dev server port fallback, request logger formatting, attach logger, and CLI serve sanitization tests passed!');
} catch (error) {
  console.error('Dev server tests failed!');
  console.error(error);
  process.exit(1);
}
