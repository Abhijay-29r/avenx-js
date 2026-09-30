import assert from 'assert';
import { escapeInlineJson, getInspectorHtml } from '../../bin/commands/serve.js';

function testScriptBreakoutIsNeutralised() {
  const baseline = getInspectorHtml({ config: { distDir: 'dist' } });
  const baselineClosers = baseline.match(/<\/script>/g) || [];

  const config = {
    distDir: 'dist</script><script>alert(1)</script>',
    outputName: 'bundle',
  };
  const html = getInspectorHtml({ config });
  const scriptCloses = html.match(/<\/script>/g) || [];

  assert.strictEqual(
    scriptCloses.length,
    baselineClosers.length,
    'evil config added ' + scriptCloses.length + ' script elements, baseline ' + baselineClosers.length,
  );
  assert.ok(
    html.indexOf('dist</script>') === -1,
    'config value must not break out of the inline script',
  );
}

function testEscapedJsonParsesBackToSameObject() {
  const config = {
    distDir: 'dist</script><script>alert(1)</script>',
    nested: { headers: { 'X-Test': 'a>b' } },
    list: [1, 'two<three'],
  };
  assert.deepStrictEqual(JSON.parse(escapeInlineJson(config)), config);
}

function testUnicodeLineTerminatorsAreEscaped() {
  const config = { value: 'line\u2028separator\u2029paragraph' };
  const escaped = escapeInlineJson(config);

  assert.ok(escaped.indexOf('\u2028') === -1, 'raw U+2028 must not survive');
  assert.ok(escaped.indexOf('\u2029') === -1, 'raw U+2029 must not survive');
  assert.ok(escaped.indexOf('\\u2028') !== -1, 'U+2028 must be backslash-u escaped');
  assert.ok(escaped.indexOf('\\u2029') !== -1, 'U+2029 must be backslash-u escaped');
  assert.deepStrictEqual(JSON.parse(escaped), config);
}

function testOrdinaryConfigRendersUnchanged() {
  const config = { distDir: 'dist', port: 3000, open: false };
  const html = getInspectorHtml({ config });
  assert.ok(
    html.includes('window.__avenx_config = {"distDir":"dist","port":3000,"open":false};'),
    'ordinary configs must serialise exactly as before',
  );
  assert.ok(html.includes('<title>Avenx Inspection Dashboard</title>'));
}

async function main() {
  try {
    testScriptBreakoutIsNeutralised();
    testEscapedJsonParsesBackToSameObject();
    testUnicodeLineTerminatorsAreEscaped();
    testOrdinaryConfigRendersUnchanged();
    console.log('Inspector inline-script escaping tests passed!');
  } catch (error) {
    console.error('Inspector inline-script escaping tests failed!');
    console.error(error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
