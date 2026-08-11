import assert from 'assert';
import {
  componentNameFromFile,
  extractLintableTemplate,
  findInvalidComponentTags,
} from '../../lib/core/tooling/componentTagNaming.js';

console.log('Testing Avenx component tag naming...');

// ----------------------------------------------------
// Test 1: Component filename -> PascalCase
// ----------------------------------------------------

assert.strictEqual(
  componentNameFromFile('user-profile.component.js'),
  'UserProfile',
);

assert.strictEqual(
  componentNameFromFile('user_profile.component.js'),
  'UserProfile',
);

assert.strictEqual(
  componentNameFromFile('UserProfile.component.js'),
  'UserProfile',
);

console.log('Component filename normalization verified!');

// ----------------------------------------------------
// Test 2: Correct PascalCase component tags
// ----------------------------------------------------

const registeredComponents = new Set([
  'UserProfile',
  'AdminPanel',
]);

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<UserProfile />',
    registeredComponents,
  ),
  [],
);

console.log('Valid PascalCase component tags accepted!');

// ----------------------------------------------------
// Test 3: kebab-case component tag
// ----------------------------------------------------

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<user-profile />',
    registeredComponents,
  ),
  [
    {
      tagName: 'user-profile',
      expectedName: 'UserProfile',
      index: 1,
    },
  ],
);

console.log('Kebab-case component tags detected!');

// ----------------------------------------------------
// Test 4: lowercase component tag
// ----------------------------------------------------

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<userprofile />',
    registeredComponents,
  ),
  [
    {
      tagName: 'userprofile',
      expectedName: 'UserProfile',
      index: 1,
    },
  ],
);

console.log('Lowercase component tags detected!');

// ----------------------------------------------------
// Test 5: camelCase component tag
// ----------------------------------------------------

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<userProfile />',
    registeredComponents,
  ),
  [
    {
      tagName: 'userProfile',
      expectedName: 'UserProfile',
      index: 1,
    },
  ],
);

console.log('camelCase component tags detected!');

// ----------------------------------------------------
// Test 6: Native HTML and unrelated custom elements
// ----------------------------------------------------

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<button /><my-web-component />',
    registeredComponents,
  ),
  [],
);

console.log('Unregistered HTML/custom elements ignored!');

// ----------------------------------------------------
// Test 7: Component inside a larger template
// ----------------------------------------------------

assert.deepStrictEqual(
  findInvalidComponentTags(
    '<div>\n  <user-profile />\n</div>',
    registeredComponents,
  ),
  [
    {
      tagName: 'user-profile',
      expectedName: 'UserProfile',
      index: 9,
    },
  ],
);

console.log('Components inside templates detected!');

// ----------------------------------------------------
// Test 8: Avenx <action> blocks must be ignored
// ----------------------------------------------------

const actionSource = `
<action name="render">
  const html = '<user-profile />';
</action>
<UserProfile />
`;

assert.deepStrictEqual(
  findInvalidComponentTags(
    actionSource,
    registeredComponents,
  ),
  [],
);

console.log('Avenx action blocks ignored!');

// ----------------------------------------------------
// Test 9: Template masking preserves line positions
// ----------------------------------------------------

const source = `<action>
foo
</action>
<UserProfile />`;

const masked = extractLintableTemplate(source);

assert.strictEqual(
  masked.split('\n').length,
  4,
);

assert.ok(
  masked.includes('<UserProfile />'),
);

assert.ok(
  !masked.includes('<action>'),
);

console.log('Template masking preserves line positions!');

console.log('All Avenx component tag naming tests passed!');