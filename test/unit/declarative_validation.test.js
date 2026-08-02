import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import {
  parseValidationRules,
  validateValue,
  updateValidationState,
} from '../../lib/core/validation/validator.js';

function testRuleParsing() {
  console.log('🧪 Testing validation rule parsing...');

  const rules1 = parseValidationRules('required|email|min:8|max:20');
  assert.strictEqual(rules1.length, 4);
  assert.deepStrictEqual(rules1[0], { name: 'required', arg: null, customMsg: null });
  assert.deepStrictEqual(rules1[1], { name: 'email', arg: null, customMsg: null });
  assert.deepStrictEqual(rules1[2], { name: 'min', arg: '8', customMsg: null });
  assert.deepStrictEqual(rules1[3], { name: 'max', arg: '20', customMsg: null });

  const rules2 = parseValidationRules('required:Field is mandatory|same:password');
  assert.strictEqual(rules2.length, 2);
  assert.deepStrictEqual(rules2[0], { name: 'required', arg: 'Field is mandatory', customMsg: null });
  assert.deepStrictEqual(rules2[1], { name: 'same', arg: 'password', customMsg: null });

  console.log('  ✅ Validation rule parsing tests passed!');
}

function testRuleValidation() {
  console.log('🧪 Testing rule evaluation logic...');

  // required
  assert.deepStrictEqual(validateValue('', [{ name: 'required', arg: null, customMsg: null }]), ['Field is required']);
  assert.deepStrictEqual(validateValue('hello', [{ name: 'required', arg: null, customMsg: null }]), []);

  // email
  assert.deepStrictEqual(validateValue('invalid', [{ name: 'email', arg: null, customMsg: null }]), ['Invalid email address']);
  assert.deepStrictEqual(validateValue('user@example.com', [{ name: 'email', arg: null, customMsg: null }]), []);

  // min / max
  assert.deepStrictEqual(validateValue('ab', [{ name: 'min', arg: '3', customMsg: null }]), ['Minimum length/value is 3']);
  assert.deepStrictEqual(validateValue('abcd', [{ name: 'max', arg: '3', customMsg: null }]), ['Maximum length/value is 3']);

  // numeric / alpha / alphanumeric
  assert.deepStrictEqual(validateValue('abc', [{ name: 'numeric', arg: null, customMsg: null }]), ['Must be a number']);
  assert.deepStrictEqual(validateValue('123a', [{ name: 'alpha', arg: null, customMsg: null }]), ['Must contain only letters']);

  // same
  const context = { state: { password: 'secret123' } };
  assert.deepStrictEqual(
    validateValue('wrong', [{ name: 'same', arg: 'password', customMsg: null }], context),
    ['Must match password']
  );
  assert.deepStrictEqual(
    validateValue('secret123', [{ name: 'same', arg: 'password', customMsg: null }], context),
    []
  );

  console.log('  ✅ Rule evaluation tests passed!');
}

function testValidationStateUpdate() {
  console.log('🧪 Testing validation state helper...');

  const state = {};
  updateValidationState(state, 'email', ['Invalid email']);

  assert.strictEqual(state.$validation.isValid, false);
  assert.deepStrictEqual(state.$validation.errors.email, ['Invalid email']);
  assert.strictEqual(state.$validation.fields.email.isValid, false);

  updateValidationState(state, 'email', []);
  assert.strictEqual(state.$validation.isValid, true);
  assert.deepStrictEqual(state.$validation.errors.email, []);
  assert.strictEqual(state.$validation.fields.email.isValid, true);

  console.log('  ✅ Validation state helper tests passed!');
}

function testComponentValidationDirective() {
  console.log('🧪 Testing Component data-ax-validate directive integration...');

  class FormComponent extends AvenxComponent {
    constructor() {
      super(
        { email: '' },
        {},
        {},
        `<div>
          <input name="email" data-ax-bind="email" data-ax-validate="required|email" />
        </div>`
      );
    }
  }

  const container = document.createElement('div');
  document.body.appendChild(container);

  const comp = new FormComponent();
  comp.__setMountTarget(container);
  comp.runUpdate();

  const inputEl = container.querySelector('input');
  assert.ok(inputEl, 'Input element should be rendered');

  // Initial validation check
  assert.ok(comp.state.$validation, '$validation property should be present on state');
  assert.strictEqual(comp.state.$validation.isValid, false);
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.email), ['Field is required']);

  // Simulate user typing invalid email
  inputEl.value = 'invalid-email';
  const inputEvent = new Event('input', { bubbles: true });
  inputEl.dispatchEvent(inputEvent);

  assert.strictEqual(comp.state.$validation.isValid, false);
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.email), ['Invalid email address']);

  // Simulate typing valid email
  inputEl.value = 'user@example.com';
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));

  assert.strictEqual(comp.state.$validation.isValid, true);
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.email), []);

  comp.unmount();
  console.log('  ✅ Component data-ax-validate directive integration tests passed!');
}

function testCustomMessagesAndMultiFields() {
  console.log('🧪 Testing custom messages and multiple fields...');

  class MultiFieldForm extends AvenxComponent {
    constructor() {
      super(
        { username: '', bio: '' },
        {},
        {},
        `<div>
          <input name="username" data-ax-bind="username" data-ax-validate="required|min:4" data-ax-validate-messages='{"required": "Username required!", "min": "Too short!"}' />
          <textarea name="bio" data-ax-bind="bio" data-ax-validate="max:10"></textarea>
        </div>`
      );
    }
  }

  const container = document.createElement('div');
  document.body.appendChild(container);

  const comp = new MultiFieldForm();
  comp.__setMountTarget(container);
  comp.runUpdate();

  const userInput = container.querySelector('input[name="username"]');
  const bioInput = container.querySelector('textarea[name="bio"]');

  assert.strictEqual(comp.state.$validation.isValid, false);
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.username), ['Username required!']);

  userInput.value = 'abc';
  userInput.dispatchEvent(new Event('input', { bubbles: true }));

  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.username), ['Too short!']);

  userInput.value = 'alex';
  userInput.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.username), []);
  assert.strictEqual(comp.state.$validation.isValid, true);

  bioInput.value = '123456789012345';
  bioInput.dispatchEvent(new Event('input', { bubbles: true }));

  assert.strictEqual(comp.state.$validation.isValid, false);
  assert.deepStrictEqual(Array.from(comp.state.$validation.errors.bio), ['Maximum length/value is 10']);

  comp.unmount();
  console.log('  ✅ Custom messages and multiple fields test passed!');
}

(async () => {
  try {
    testRuleParsing();
    testRuleValidation();
    testValidationStateUpdate();
    testComponentValidationDirective();
    testCustomMessagesAndMultiFields();
    console.log('🎉 All declarative validation tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Declarative validation tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
