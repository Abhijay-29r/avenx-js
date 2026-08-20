import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

console.log('Testing AvenxApp registration inspection APIs...');

const container = document.createElement('div');
container.id = 'app';
document.body.appendChild(container);

class TestComponent extends AvenxComponent {}

class AnotherComponent extends AvenxComponent {}

class HomePage extends AvenxComponent {}

class AboutPage extends AvenxComponent {}

const app = new AvenxApp({ target: '#app' });

console.log('Testing registered component names...');

app.register('TestComponent', TestComponent);
app.register('AnotherComponent', AnotherComponent);

assert.deepStrictEqual(
  app.getRegisteredComponents(),
  ['VirtualList', 'TestComponent', 'AnotherComponent'],
  'getRegisteredComponents() should return registered component names',
);

console.log('Registered component names returned correctly.');

console.log('Testing registered page names...');

app.registerPage('HomePage', HomePage);
app.registerPage('AboutPage', AboutPage);

assert.deepStrictEqual(
  app.getRegisteredPages(),
  ['HomePage', 'AboutPage'],
  'getRegisteredPages() should return registered page names',
);

console.log('Registered page names returned correctly.');

console.log('Testing registration and mounting of component created via AvenxComponent.extend()...');

const ExtendedCard = AvenxComponent.extend({
  name: 'ExtendedCard',
  state: { theme: 'dark' },
  methods: {
    toggleTheme() {
      this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    },
  },
});

app.register('ExtendedCard', ExtendedCard);
assert.ok(
  app.getRegisteredComponents().includes('ExtendedCard'),
  'getRegisteredComponents() should include ExtendedCard',
);

const cardInstance = new ExtendedCard();
assert.strictEqual(cardInstance.state.theme, 'dark');
cardInstance.toggleTheme();
assert.strictEqual(cardInstance.state.theme, 'light');

console.log('AvenxComponent.extend() registration and instantiation test passed.');

console.log('AvenxApp registration inspection tests passed.');