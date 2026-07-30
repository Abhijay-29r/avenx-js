import assert from 'assert';
import { EventEmitter } from 'events';
import { listenWithPortFallback } from '../../bin/commands/serve.js';

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

try {
  runTests();
  console.log('Dev server port fallback tests passed!');
} catch (error) {
  console.error('Dev server port fallback tests failed!');
  console.error(error);
  process.exit(1);
}
