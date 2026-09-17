/**
 * @file eventHandlerAttributes.test.js
 * @description Inline `on*` handler attributes on HTML elements.
 *
 * A bound `on*` attribute (`onclick="{{ expr }}"`) wrote a reactive value into
 * an inline handler that the browser executes — `eval` of state, re-run on
 * every update. It is refused at build time (AVX_C28) with `@event` as the
 * safe alternative. A static inline handler (`onclick="doThing()"`) is the
 * developer's own code; it is kept but warned about (AVX_W52), because it
 * bypasses the event system and a strict CSP.
 *
 * `@click` and the event modifiers are the documented mechanism and are never
 * flagged. `on*` on a child component is a prop, not a DOM handler, so it is
 * never flagged either.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-on-attr-'));
let counter = 0;

/**
 * Compiles a component source, capturing warnings.
 * @param {string} source - The component file contents.
 * @returns {{warnings: string[], error: (Error|null)}} What happened.
 */
function compile(source) {
  counter += 1;
  const dir = path.join(workDir, String(counter));
  fs.mkdirSync(dir);
  const file = path.join(dir, 'probe.component.js');
  fs.writeFileSync(file, source);
  const warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (message) => warnings.push(String(message));
  let error = null;
  try {
    new ComponentParser(new StyleProcessor()).parse(file);
  } catch (thrown) {
    error = thrown;
  } finally {
    logger.warn = originalWarn;
  }
  return { warnings, error };
}

try {
  console.log('🧪 A bound on* handler is a build error');
  for (const source of [
    '<state js="\'\'" />\n<div><button onclick="{{ js }}">x</button></div>',
    '<state u="\'\'" />\n<img src="{{ u }}" onerror="{{ u }}" />',
    '<state h="\'\'" />\n<div><button ONCLICK="{{ h }}">x</button></div>',
    '<state h="\'\'" />\n<a onmouseover="go {{ h }}">x</a>',
  ]) {
    const { error } = compile(source);
    assert.ok(error, `must fail: ${source}`);
    assert.strictEqual(error.code, AvenxErrorCodes.COMPILER_BOUND_EVENT_ATTRIBUTE, error.message);
    assert.match(error.message, /@/, 'the message points at the @event form');
  }

  console.log('🧪 A static inline on* handler warns but compiles');
  const staticHandler = compile('<div><button onclick="handleThing()">x</button></div>');
  assert.strictEqual(staticHandler.error, null, staticHandler.error && staticHandler.error.message);
  const w52 = staticHandler.warnings.filter((m) => m.includes('AVX_W52'));
  assert.strictEqual(w52.length, 1, `one AVX_W52, got:\n${staticHandler.warnings.join('\n')}`);
  assert.match(w52[0], /onclick/);

  console.log('🧪 The documented event system is never flagged');
  for (const source of [
    '<state c="0" />\n<div><button @click="c++">x</button></div>',
    '<state c="0" />\n<div><button @click.prevent.stop="c++">x</button></div>',
    '<state t="\'\'" />\n<input @input="t = event.target.value" />',
    '<div><button @keydown.enter="submit()">x</button></div>',
  ]) {
    const { error, warnings } = compile(source);
    assert.strictEqual(error, null, `must compile: ${source} -> ${error && error.message}`);
    assert.deepStrictEqual(warnings.filter((m) => m.includes('AVX_W52') || m.includes('AVX_C28')), []);
  }

  console.log('🧪 on* on a child component is a prop, not a handler');
  // PascalCase tag: the value is a prop passed to the child, never set as a DOM
  // handler, so neither the error nor the warning fires.
  const componentProp = compile('<state cb="null" />\n<div><Child onClick="{{ cb }}" onready="init()" /></div>');
  assert.strictEqual(componentProp.error, null, componentProp.error && componentProp.error.message);
  assert.deepStrictEqual(componentProp.warnings.filter((m) => m.includes('AVX_W52') || m.includes('AVX_C28')), []);

  console.log('🧪 An attribute merely starting with "on" is not a handler');
  // `once` and `ontology` are ordinary attributes; only `on` + a real handler
  // name matters. These must not be flagged.
  const notHandlers = compile('<state v="\'\'" />\n<div once="{{ v }}" data-online="{{ v }}">x</div>');
  assert.strictEqual(notHandlers.error, null, notHandlers.error && notHandlers.error.message);
  assert.deepStrictEqual(notHandlers.warnings.filter((m) => m.includes('AVX_W52') || m.includes('AVX_C28')), []);

  console.log('  ✅ Event handler attribute tests passed!');
} catch (error) {
  console.error('❌ Event handler attribute tests failed:', error);
  process.exitCode = 1;
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
