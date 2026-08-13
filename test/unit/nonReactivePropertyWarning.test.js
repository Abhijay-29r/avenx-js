import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

function runTests() {
  console.log('🧪 Testing Runtime Warning when Mutating Non-Reactive Local Properties on AvenxComponent...');

  // Setup warning listener
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => {
    warnings.push(msg);
  };

  const cleanup = () => {
    console.warn = originalWarn;
  };

  try {
    // ----------------------------------------------------
    // Test 1: Mutating unregistered property after initialization in development mode
    // ----------------------------------------------------
    console.log('  Testing mutating unregistered property in development mode...');
    process.env.NODE_ENV = 'development';
    
    class TestComponent extends AvenxComponent {
      constructor() {
        super({ count: 0 });
        // Assignment inside constructor should NOT warn
        this.localInConstructor = 'okay';
      }
      
      mutateNonReactive() {
        this.counter = 5;
      }
      
      mutateRegistered() {
        this.localInConstructor = 'updated';
      }
      
      mutatePrivateOrInternal() {
        this.$app = {};
        this._privateInternal = 'internal';
        this.renderWatcher = {};
      }
    }

    const comp = new TestComponent();
    
    // Ensure no warnings were logged during constructor
    try {
      assert.strictEqual(warnings.length, 0, 'No warning should be logged during constructor');
    } catch (err) {
      cleanup();
      return Promise.reject(err);
    }

    // Wait a macro/microtask for initialization to finish
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          // Mutate unregistered property after initialization
          comp.mutateNonReactive();
          
          assert.strictEqual(warnings.length, 1, 'Should log exactly one warning for counter');
          assert.ok(warnings[0].includes('[Avenx Warning]'), 'Warning should start with [Avenx Warning]');
          assert.ok(warnings[0].includes('Direct assignment to "this.counter = 5"'), 'Warning should mention direct assignment');
          assert.ok(warnings[0].includes('on component <TestComponent>'), 'Warning should mention component name');
          assert.ok(warnings[0].includes('Declare "counter" in <state> instead'), 'Warning should suggest state declaration');

          // Mutate registered property (defined in constructor)
          comp.mutateRegistered();
          assert.strictEqual(warnings.length, 1, 'Should not log another warning for mutating already registered properties');

          // Mutate private/internal/special properties starting with $, _ or renderWatcher
          comp.mutatePrivateOrInternal();
          assert.strictEqual(warnings.length, 1, 'Should not log warning for internal/private properties');

          // ----------------------------------------------------
          // Test 2: instanceof checks work with subclass prototype proxying
          // ----------------------------------------------------
          console.log('  Testing instanceof checks...');
          assert.ok(comp instanceof TestComponent, 'Component should be instance of TestComponent');
          assert.ok(comp instanceof AvenxComponent, 'Component should be instance of AvenxComponent');

          // ----------------------------------------------------
          // Test 3: No warning in production mode
          // ----------------------------------------------------
          console.log('  Testing behavior in production mode...');
          process.env.NODE_ENV = 'production';
          warnings.length = 0;

          class ProdComponent extends AvenxComponent {
            mutateNonReactive() {
              this.prodCounter = 10;
            }
          }

          const prodComp = new ProdComponent();
          
          setTimeout(() => {
            try {
              prodComp.mutateNonReactive();
              assert.strictEqual(warnings.length, 0, 'Should not log warnings in production mode');
              
              console.log('  ✅ Non-reactive local property warning tests passed successfully!');
              cleanup();
              resolve();
            } catch (err) {
              cleanup();
              reject(err);
            }
          }, 10);

        } catch (err) {
          cleanup();
          reject(err);
        }
      }, 10);
    });
  } catch (err) {
    cleanup();
    return Promise.reject(err);
  }
}

// Since the test contains asynchronous checks, we handle it as a promise chain
runTests().catch((error) => {
  console.error('❌ Non-reactive local property warning tests failed!');
  console.error(error);
  process.exit(1);
});
