/**
 * @file dynamicAttributeInterpolation.test.js
 * @description `:[name]="value"` takes expressions in both slots, and says so
 * when it is handed an interpolation instead.
 *
 * The two halves of the construct used to fail differently, and neither failed
 * usefully:
 *
 * - `:[{{ k }}]="v"` reached the code generator as the expression `{{ k }}`,
 *   which is not valid JavaScript. A production build reported AVX_C27
 *   ("Expected a property name") -- the symptom, not the construct -- and a
 *   development build compiled without complaint.
 * - `:[k]="{{ v }}"` did not fail at all. The *name* still resolved, so the
 *   element was tagged `data-ax-dyn-attrs="data-tone"`, claiming the attribute
 *   was being managed, while no attribute was ever set. Measured in a browser
 *   in both build modes.
 *
 * Both are now refused at build time as AVX_C29, naming the unbraced form.
 * This also pins the placeholder substitution in the diagnostic itself, which
 * silently printed `{1}` and `{3}` to users of AVX_C28.
 */
import assert from 'assert';

process.env.NODE_ENV = 'test';

import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { AvenxErrorCodes, formatMessage } from '../../lib/core/runtime/AvenxError.js';

/**
 * Validates a template and returns the error it raised, if any.
 * @param {string} template - The template source.
 * @returns {Error|null} The thrown error, or null when it validated.
 */
function validate(template) {
  const parser = new ComponentParser(new StyleProcessor(), [], { warnings: {} });
  try {
    parser.validateDynamicAttributeBindings(template, template, 'Demo.component.js', 'Demo');
    return null;
  } catch (error) {
    return error;
  }
}

try {
  console.log('🧪 Testing interpolated dynamic attribute bindings (AVX_C29)...');

  // 1. The documented form is untouched.
  for (const ok of [
    '<span :[k]="v">x</span>',
    '<span :[props.name]="props.value">x</span>',
    '<span :[cond ? a : b]="v">x</span>',
    '<span data-tone="{{ v }}">x</span>',
    '<span>{{ v }}</span>',
  ]) {
    assert.strictEqual(validate(ok), null, `the supported form must still compile: ${ok}`);
  }
  console.log('  ✅ the documented expression form still compiles');

  // 2. A braced value is refused, and the message names the construct.
  {
    const error = validate('<span :[k]="{{ v }}">x</span>');
    assert.ok(error, 'an interpolated value is refused');
    assert.strictEqual(error.code, AvenxErrorCodes.COMPILER_INTERPOLATED_DYNAMIC_ATTRIBUTE);
    assert.ok(error.message.includes('value is an interpolation'), 'it names which slot');
    assert.ok(error.message.includes(':[k]="v"'), 'and offers the unbraced form as the fix');
  }

  // 3. A braced name is refused the same way, rather than surfacing later as a
  //    production-only expression error.
  {
    const error = validate('<span :[{{ k }}]="v">x</span>');
    assert.ok(error, 'an interpolated attribute name is refused');
    assert.strictEqual(error.code, AvenxErrorCodes.COMPILER_INTERPOLATED_DYNAMIC_ATTRIBUTE);
    assert.ok(error.message.includes('attribute name is an interpolation'), 'it names which slot');
    assert.ok(error.message.includes(':[k]="v"'), 'and offers the unbraced form as the fix');
  }
  console.log('  ✅ both slots are refused when written as interpolations');

  // 4. No diagnostic may print a placeholder to the user. AVX_C28 refers to
  //    two of its arguments twice, and printed "{1}" and "{3}" verbatim.
  {
    const message = formatMessage(
      AvenxErrorCodes.COMPILER_BOUND_EVENT_ATTRIBUTE,
      'Demo',
      'onclick',
      '<button onclick="{{ handler }}">',
      'click',
    );
    assert.ok(!/\{\d\}/.test(message), `every placeholder must be substituted, got: ${message}`);
    assert.ok(message.includes('@click="handler()"'), 'the repeated argument is substituted too');
  }

  // 5. A placeholder with no argument is left as written rather than becoming
  //    the string "undefined", which is what the old loop did.
  {
    const partial = formatMessage(AvenxErrorCodes.COMPILER_BOUND_EVENT_ATTRIBUTE, 'Demo');
    assert.ok(partial.includes('{1}'), 'an unsupplied placeholder is left alone');
    assert.ok(!partial.includes('undefined'), 'and does not become "undefined"');
  }
  console.log('  ✅ diagnostics substitute every placeholder');

  console.log('Dynamic attribute interpolation tests passed!');
} catch (error) {
  console.error('Dynamic attribute interpolation tests failed!');
  console.error(error);
  process.exit(1);
}
