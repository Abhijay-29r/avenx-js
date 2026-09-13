/**
 * A build that links a capability must ship it.
 *
 * `assertRuntimeCapabilities` is the postcondition on AVX_W47. The build tells
 * a developer their component renders through the string renderer; if the
 * artifact does not contain it, the honest outcome is a failed build, not an
 * application that mounts and shows nothing.
 *
 * The interesting case is the third one. The obvious evidence for "the string
 * renderer was installed" is the text `installStringRenderer(` -- and that is
 * the wrong test, because the registry's own declaration reads the same and
 * `AvenxComponent` imports the registry in every bundle in order to read from
 * it. A check written that way passes on exactly the broken bundle it exists
 * to catch.
 */
import assert from 'assert';
import { assertRuntimeCapabilities } from '../../lib/compiler/bundle/validate.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

console.log('🧪 Testing runtime capability validation...');

/** The capability descriptor the compiler builds for a fallback build. */
const STRING_RENDERER = [
  {
    capability: 'the string renderer',
    reason: '1 template(s) could not be compiled to a render program (AVX_W47)',
    evidence: 'installStringRenderer\\(\\s*\\{',
  },
];

/** A bundle that declares the registry but never fills it. */
const DECLARED_ONLY = `
function installStringRenderer(classes) { installed = classes; }
function requireStringRenderer() { return installed; }
`;

/** A bundle that also runs the installer. */
const INSTALLED = `${DECLARED_ONLY}
installStringRenderer({ DomPatcher, ListManager, DeferManager, TemplateRenderer });
`;

/**
 * Wraps a bundle source in the output map shape the compiler passes.
 * @param {string} code - The bundle source.
 * @returns {Map<string, string>} The outputs.
 */
function outputs(code) {
  return new Map([
    ['bundle.js', code],
    ['bundle.css', ''],
  ]);
}

// Nothing linked, nothing to assert.
assertRuntimeCapabilities(outputs(''), []);
assertRuntimeCapabilities(outputs(''), undefined);
console.log('  ✅ a build that linked no capability is not checked');

// The installed bundle passes.
assertRuntimeCapabilities(outputs(INSTALLED), STRING_RENDERER);
console.log('  ✅ a bundle that installs the string renderer passes');

// The declared-but-never-installed bundle fails -- the regression this exists for.
assert.throws(
  () => assertRuntimeCapabilities(outputs(DECLARED_ONLY), STRING_RENDERER),
  (error) => {
    assert.strictEqual(error.code, AvenxErrorCodes.COMPILER_MISSING_RUNTIME_CAPABILITY);
    assert.ok(
      String(error.message).includes('the string renderer'),
      'the diagnostic should name the missing capability',
    );
    assert.ok(
      String(error.message).includes('AVX_W47'),
      'the diagnostic should say why the capability was linked',
    );
    return true;
  },
  'a bundle that declares the registry but never fills it must fail the build',
);
console.log('  ✅ a bundle that declares but never installs it fails with AVX_C23');

// Minification strips indentation but not the call, so the evidence survives it.
assertRuntimeCapabilities(
  outputs('installStringRenderer({DomPatcher,ListManager,DeferManager,TemplateRenderer});'),
  STRING_RENDERER,
);
console.log('  ✅ the evidence survives minification');

// A source map is not the bundle, and must not be mistaken for it.
const withMap = new Map([
  ['bundle.js.map', JSON.stringify({ sources: [] })],
  ['bundle.js', INSTALLED],
]);
assertRuntimeCapabilities(withMap, STRING_RENDERER);
console.log('  ✅ the source map is not mistaken for the bundle');

console.log('✅ All runtime capability validation tests passed!');
