import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import avenxTemplateParser from '../../lib/core/tooling/avenxTemplateParser.js';
import { componentTagNamingRule } from '../../lib/core/tooling/eslintComponentTagNaming.js';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.component.js', '**/*.page.js'],

      languageOptions: {
        parser: avenxTemplateParser,
      },

      plugins: {
        avenx: {
          rules: {
            'component-tag-naming': componentTagNamingRule,
          },
        },
      },

      rules: {
        'avenx/component-tag-naming': [
          'error',
          {
            componentNames: [
              'UserProfile',
              'AdminPanel',
            ],
          },
        ],
      },
    },
  ],
});

async function lint(source) {
  return eslint.lintText(source, {
    filePath: 'src/components/test.component.js',
  });
}

// ----------------------------------------------------
// Test 1: Correct PascalCase component
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <UserProfile />
</div>
`);

  assert.strictEqual(result.errorCount, 0);

  console.log('Valid PascalCase component accepted!');
}

// ----------------------------------------------------
// Test 2: kebab-case component
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <user-profile />
</div>
`);

  assert.strictEqual(result.errorCount, 1);

  assert.strictEqual(
    result.messages[0].ruleId,
    'avenx/component-tag-naming',
  );

  assert.match(
    result.messages[0].message,
    /UserProfile/,
  );

  console.log('Kebab-case component rejected!');
}

// ----------------------------------------------------
// Test 3: lowercase component
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <userprofile />
</div>
`);

  assert.strictEqual(result.errorCount, 1);

  assert.strictEqual(
    result.messages[0].ruleId,
    'avenx/component-tag-naming',
  );

  console.log('Lowercase component rejected!');
}

// ----------------------------------------------------
// Test 4: camelCase component
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <userProfile />
</div>
`);

  assert.strictEqual(result.errorCount, 1);

  assert.strictEqual(
    result.messages[0].ruleId,
    'avenx/component-tag-naming',
  );

  console.log('camelCase component rejected!');
}

// ----------------------------------------------------
// Test 5: Native HTML elements are ignored
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <button />
    <input />
    <span />
</div>
`);

  assert.strictEqual(result.errorCount, 0);

  console.log('Native HTML elements ignored!');
}

// ----------------------------------------------------
// Test 6: Unregistered custom elements are ignored
// ----------------------------------------------------

{
  const [result] = await lint(`
<div>
    <my-web-component />
</div>
`);

  assert.strictEqual(result.errorCount, 0);

  console.log('Unregistered custom elements ignored!');
}

// ----------------------------------------------------
// Test 7: Avenx metadata blocks are ignored
// ----------------------------------------------------

{
  const [result] = await lint(`
<state name="Test" />

<action name="render">
    <user-profile />
</action>

<div>
    <UserProfile />
</div>
`);

  assert.strictEqual(result.errorCount, 0);

  console.log('Avenx metadata blocks ignored!');
}

console.log('All ESLint component tag naming tests passed!');