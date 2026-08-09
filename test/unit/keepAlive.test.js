import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';

let activeHistory = [];

class PageA extends AvenxPage {
  constructor(bridges, componentRegistry) {
    super(
      { text: 'Initial A' },
      {},
      bridges,
      '<div>Page A</div>',
      {},
      componentRegistry
    );
  }

  onActivate(params) {
    activeHistory.push({ page: 'A', action: 'activate', params });
  }

  onDeactivate() {
    activeHistory.push({ page: 'A', action: 'deactivate' });
  }

  onMount() {
    activeHistory.push({ page: 'A', action: 'mount' });
  }

  onUnmount() {
    activeHistory.push({ page: 'A', action: 'unmount' });
  }
}

class PageB extends AvenxPage {
  constructor(bridges, componentRegistry) {
    super(
      { text: 'Initial B' },
      {},
      bridges,
      '<div>Page B</div>',
      {},
      componentRegistry
    );
  }

  onActivate(params) {
    activeHistory.push({ page: 'B', action: 'activate', params });
  }

  onDeactivate() {
    activeHistory.push({ page: 'B', action: 'deactivate' });
  }

  onMount() {
    activeHistory.push({ page: 'B', action: 'mount' });
  }

  onUnmount() {
    activeHistory.push({ page: 'B', action: 'unmount' });
  }
}

class PageC extends AvenxPage {
  constructor(bridges, componentRegistry) {
    super(
      { text: 'Initial C' },
      {},
      bridges,
      '<div>Page C</div>',
      {},
      componentRegistry
    );
  }

  onActivate(params) {
    activeHistory.push({ page: 'C', action: 'activate', params });
  }

  onDeactivate() {
    activeHistory.push({ page: 'C', action: 'deactivate' });
  }

  onMount() {
    activeHistory.push({ page: 'C', action: 'mount' });
  }

  onUnmount() {
    activeHistory.push({ page: 'C', action: 'unmount' });
  }
}

async function testKeepAliveBasic() {
  console.log('🧪 Testing Keep-Alive caching, activation and deactivation...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app', keepAliveLimit: 2 });
  app.registerPage('PageA', PageA);
  app.registerPage('PageB', PageB);
  app.registerPage('PageC', PageC);

  // 1. Mount PageA (first mount)
  app.mountPage('PageA', { id: '1' }, { keepAlive: true });
  assert.strictEqual(container.innerHTML.includes('Page A'), true);

  // Initial mount should trigger: mount -> activate
  assert.deepStrictEqual(activeHistory, [
    { page: 'A', action: 'mount' },
    { page: 'A', action: 'activate', params: { id: '1' } }
  ]);

  // Save reference of the first instance
  const pageAInstance = container.__avenx_comp_instance;
  assert.ok(pageAInstance);

  // 2. Mount PageB, pushing PageA to keep-alive cache
  activeHistory = [];
  app.mountPage('PageB', { id: '2' }, { keepAlive: true });
  assert.strictEqual(container.innerHTML.includes('Page B'), true);

  // PageA should deactivate (not unmount), PageB should mount -> activate
  assert.deepStrictEqual(activeHistory, [
    { page: 'A', action: 'deactivate' },
    { page: 'B', action: 'mount' },
    { page: 'B', action: 'activate', params: { id: '2' } }
  ]);

  // 3. Mount PageA again, restoring it from cache
  activeHistory = [];
  app.mountPage('PageA', { id: '3' }, { keepAlive: true });
  assert.strictEqual(container.innerHTML.includes('Page A'), true);

  // PageB should deactivate, PageA should restore and trigger activate
  assert.deepStrictEqual(activeHistory, [
    { page: 'B', action: 'deactivate' },
    { page: 'A', action: 'activate', params: { id: '3' } }
  ]);

  // Assert that it's the exact same instance restored
  const restoredInstance = container.__avenx_comp_instance;
  assert.strictEqual(restoredInstance, pageAInstance, 'Should restore the same page instance');
  assert.strictEqual(restoredInstance.params.id, '3', 'Should update params on restored instance');

  global.document.body.removeChild(container);
  console.log('  ✅ Keep-Alive basic tests passed!');
}

async function testKeepAliveEviction() {
  console.log('🧪 Testing Keep-Alive cache eviction (LRU)...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app', keepAliveLimit: 1 });
  app.registerPage('PageA', PageA);
  app.registerPage('PageB', PageB);
  app.registerPage('PageC', PageC);

  // Mount PageA
  app.mountPage('PageA', {}, { keepAlive: true });
  // Mount PageB (caches PageA)
  app.mountPage('PageB', {}, { keepAlive: true });
  // Mount PageC (caches PageB, evicts PageA because limit is 1)
  activeHistory = [];
  app.mountPage('PageC', {}, { keepAlive: true });

  // PageA should be evicted and thus unmounted
  const hasPageAUnmounted = activeHistory.some(h => h.page === 'A' && h.action === 'unmount');
  assert.strictEqual(hasPageAUnmounted, true, 'PageA should be unmounted when evicted');

  global.document.body.removeChild(container);
  console.log('  ✅ Keep-Alive cache eviction tests passed!');
}

async function testSameClassReuse() {
  console.log('🧪 Testing Same-Class Page reuse...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app' });
  app.registerPage('PageA', PageA);

  app.mountPage('PageA', { id: '10' });
  const instance1 = container.__avenx_comp_instance;

  activeHistory = [];
  app.mountPage('PageA', { id: '20' });
  const instance2 = container.__avenx_comp_instance;

  assert.strictEqual(instance1, instance2, 'Same class should reuse active component');
  assert.deepStrictEqual(activeHistory, [
    { page: 'A', action: 'activate', params: { id: '20' } }
  ]);

  global.document.body.removeChild(container);
  console.log('  ✅ Same-Class Page reuse tests passed!');
}

async function testClearKeepAliveCacheSpecific() {
  console.log('🧪 Testing app.clearKeepAliveCache(componentName)...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app', keepAliveLimit: 5 });
  app.registerPage('PageA', PageA);
  app.registerPage('PageB', PageB);
  app.registerPage('PageC', PageC);

  // Mount PageA with keepAlive
  app.mountPage('PageA', {}, { keepAlive: true });
  // Mount PageB with keepAlive (caches PageA)
  app.mountPage('PageB', {}, { keepAlive: true });

  activeHistory = [];

  // Clear specific page 'PageA' from cache
  app.clearKeepAliveCache('PageA');

  // PageA's onUnmount should be triggered
  const hasPageAUnmounted = activeHistory.some((h) => h.page === 'A' && h.action === 'unmount');
  assert.strictEqual(hasPageAUnmounted, true, 'PageA should be unmounted when cleared from keep-alive cache');

  // Mount PageA again - should create a fresh instance (not restored)
  activeHistory = [];
  app.mountPage('PageA', {}, { keepAlive: true });

  const hasPageAMountedFresh = activeHistory.some((h) => h.page === 'A' && h.action === 'mount');
  assert.strictEqual(hasPageAMountedFresh, true, 'PageA should be freshly mounted after invalidation');

  global.document.body.removeChild(container);
  console.log('  ✅ app.clearKeepAliveCache(componentName) test passed!');
}

async function testClearKeepAliveCacheAll() {
  console.log('🧪 Testing app.clearKeepAliveCache() purging all entries...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app', keepAliveLimit: 5 });
  app.registerPage('PageA', PageA);
  app.registerPage('PageB', PageB);
  app.registerPage('PageC', PageC);

  // Mount PageA, PageB (PageA cached)
  app.mountPage('PageA', {}, { keepAlive: true });
  app.mountPage('PageB', {}, { keepAlive: true });

  activeHistory = [];

  // Clear all keep-alive entries
  app.clearKeepAliveCache();

  const hasPageAUnmounted = activeHistory.some((h) => h.page === 'A' && h.action === 'unmount');
  assert.strictEqual(hasPageAUnmounted, true, 'PageA should be unmounted when purging all cache');

  global.document.body.removeChild(container);
  console.log('  ✅ app.clearKeepAliveCache() all entries test passed!');
}

async function testComponentKeepAliveClear() {
  console.log('🧪 Testing this.$keepAlive.clear() from component instance...');

  const container = global.document.createElement('div');
  container.id = 'app';
  global.document.body.appendChild(container);

  activeHistory = [];

  const app = new AvenxApp({ target: '#app', keepAliveLimit: 5 });
  app.registerPage('PageA', PageA);
  app.registerPage('PageB', PageB);

  app.mountPage('PageA', {}, { keepAlive: true });
  app.mountPage('PageB', {}, { keepAlive: true });

  const activeComp = container.__avenx_comp_instance;
  assert.ok(activeComp);
  assert.ok(activeComp.$keepAlive);
  assert.strictEqual(typeof activeComp.$keepAlive.clear, 'function');

  activeHistory = [];
  activeComp.$keepAlive.clear('PageA');

  const hasPageAUnmounted = activeHistory.some((h) => h.page === 'A' && h.action === 'unmount');
  assert.strictEqual(hasPageAUnmounted, true, 'this.$keepAlive.clear should trigger unmount of cached component');

  global.document.body.removeChild(container);
  console.log('  ✅ this.$keepAlive.clear() test passed!');
}

try {
  await testKeepAliveBasic();
  await testKeepAliveEviction();
  await testSameClassReuse();
  await testClearKeepAliveCacheSpecific();
  await testClearKeepAliveCacheAll();
  await testComponentKeepAliveClear();
  console.log('✅ All Keep-Alive integration tests successfully completed!');
} catch (error) {
  console.error('❌ Keep-Alive integration tests failed!');
  console.error(error);
  process.exit(1);
}
