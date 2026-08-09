import assert from 'assert';
import { EventEmitter } from 'events';
import { listenWithPortFallback } from '../../bin/commands/serve.js';
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

try {
  runTests();
  await testCliServeParsing();
  console.log('Dev server port fallback and CLI serve sanitization tests passed!');
} catch (error) {
  console.error('Dev server tests failed!');
  console.error(error);
  process.exit(1);
}
