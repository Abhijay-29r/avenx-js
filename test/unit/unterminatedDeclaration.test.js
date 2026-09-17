/**
 * @file unterminatedDeclaration.test.js
 * @description An unclosed raw-text declaration fails the build with a
 * diagnostic, never with a crash.
 *
 * `scanTags` jumps from an `<action>`, `<resource>`, `<script>` or `<style>`
 * open tag to its close tag without reading the body. When no close tag exists,
 * `findRawTextClose` returns null, and the scanner read `.end` from it: the
 * build died with "Cannot read properties of null (reading 'end')" and no file
 * or line. The documented SFC tag-order example in best-practices/guide.md
 * reproduced it.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanTags } from '../../lib/compiler/parser/tokenizer.js';
import { parseDeclarations } from '../../lib/compiler/parser/declarations.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-unterminated-'));

try {
  console.log('🧪 Unclosed raw-text declarations');

  // The scanner no longer throws, for a wanted or an unwanted raw-text tag.
  const unclosedAction = '<state count="0" />\n<action name="inc">\n  count++;\n<div>{{ count }}</div>';
  assert.doesNotThrow(() => scanTags(unclosedAction, new Set(['state', 'action'])));
  assert.doesNotThrow(() => scanTags('<script>\nlet a = 1;\n<div></div>', new Set(['state'])));

  // The declaration set reports what was left open, with its offset.
  const declarations = parseDeclarations(unclosedAction);
  assert.deepStrictEqual(
    declarations.unterminated.map((entry) => [entry.name, entry.offset]),
    [['action', unclosedAction.indexOf('<action')]],
  );
  assert.deepStrictEqual(parseDeclarations('<action name="a">x</action>').unterminated, []);

  // The documented tag-order example compiles to a located AVX_C26.
  const file = path.join(workDir, 'probe.component.js');
  fs.writeFileSync(file, '<state>\n<computed>\n<action>\n<resource>\n<template>\n<style>\n');
  assert.throws(
    () => new ComponentParser(new StyleProcessor()).parse(file),
    (error) => {
      assert.strictEqual(error.code, AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE, error.message);
      assert.match(error.message, /<action>/);
      assert.strictEqual(error.line, 3, 'the location points at the unclosed tag');
      return true;
    },
  );

  console.log('  ✅ Unclosed raw-text declaration tests passed!');
} catch (error) {
  console.error('❌ Unclosed raw-text declaration tests failed:', error);
  process.exitCode = 1;
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
