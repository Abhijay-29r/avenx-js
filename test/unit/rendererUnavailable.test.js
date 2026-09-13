/**
 * What a component says when the rendering engine it needs is not in the bundle.
 *
 * This condition should be unreachable: the compiler links the string renderer
 * when any template falls back, and AVX_C23 fails the build if the artifact
 * does not contain it. It was reachable once -- the same runtime file bundled
 * twice split the registry -- and the diagnostic it produced then was
 * AVX_R08, "Failed to render interpolation expression", which sent developers
 * to inspect an expression that was not the problem.
 *
 * The message is the last line of defence for a defect that should not recur,
 * so it is worth holding to: it names the component, it names the capability,
 * and it carries a code `avenx explain` can describe.
 */
import assert from 'assert';
import { requireStringRenderer, hasStringRenderer, installStringRenderer } from '../../lib/core/renderer/stringRenderer.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';
import { getDiagnostic } from '../../lib/core/diagnostics/catalogue.js';

console.log('🧪 Testing renderer availability diagnostics...');

// The test runner installs the string renderer into every test process, the
// way a development build does. Taking it away is the only way to observe the
// condition, so it is restored immediately afterwards.
const saved = hasStringRenderer() ? requireStringRenderer() : null;

try {
  installStringRenderer(null);

  assert.strictEqual(hasStringRenderer(), false, 'the registry should read as empty once cleared');

  assert.throws(
    () => requireStringRenderer('CartSummary'),
    (error) => {
      assert.strictEqual(
        error.code,
        AvenxErrorCodes.RENDERER_UNAVAILABLE,
        'the condition should have its own code, not the generic template-render error',
      );
      assert.notStrictEqual(
        error.code,
        AvenxErrorCodes.TEMPLATE_RENDER_ERROR,
        'reusing AVX_R08 made this read as a failed interpolation',
      );
      assert.ok(String(error.message).includes('CartSummary'), 'the message should name the component');
      assert.ok(String(error.message).includes('the string renderer'), 'the message should name the capability');
      assert.ok(String(error.message).includes('AVX_W47'), 'the message should point at the build warning that links it');
      return true;
    },
  );
  console.log('  ✅ an unavailable renderer raises AVX_R34 naming the component');

  // A code a developer can be shown has to be a code the CLI can describe.
  const entry = getDiagnostic(AvenxErrorCodes.RENDERER_UNAVAILABLE);
  assert.ok(entry, 'AVX_R34 should be in the diagnostic catalogue');
  assert.ok(entry.summary && entry.summary.length > 0, 'it should have a summary');
  assert.ok(Array.isArray(entry.causes) && entry.causes.length > 0, 'it should list causes');
  assert.ok(Array.isArray(entry.remedies) && entry.remedies.length > 0, 'it should list remedies');
  console.log('  ✅ AVX_R34 is explainable through the diagnostic catalogue');

  // ...and so does the one the runtime raises when nothing claims an error.
  const aborted = getDiagnostic(AvenxErrorCodes.COMPONENT_RENDER_ABORTED);
  assert.ok(aborted, 'AVX_R33 should be in the diagnostic catalogue');
  assert.ok(Array.isArray(aborted.remedies) && aborted.remedies.length > 0, 'AVX_R33 should list remedies');
  console.log('  ✅ AVX_R33 is explainable through the diagnostic catalogue');

  const missing = getDiagnostic(AvenxErrorCodes.COMPILER_MISSING_RUNTIME_CAPABILITY);
  assert.ok(missing, 'AVX_C23 should be in the diagnostic catalogue');
  console.log('  ✅ AVX_C23 is explainable through the diagnostic catalogue');

  // Restoring it makes the condition go away again.
  if (saved) {
    installStringRenderer(saved);
    assert.ok(hasStringRenderer(), 'the registry should read as filled once restored');
    assert.strictEqual(requireStringRenderer('CartSummary'), saved);
    console.log('  ✅ a filled registry returns the renderer');
  }

  console.log('✅ All renderer availability tests passed!');
} finally {
  installStringRenderer(saved);
}
