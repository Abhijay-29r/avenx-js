import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { runInspect } from '../../bin/commands/inspect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, 'inspect-unit-test-project');

function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

console.log('🧪 Testing bin/commands/inspect.js unit logic...');

try {
  setup();

  const srcDir = path.join(TEST_DIR, 'src');
  fs.mkdirSync(path.join(srcDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(srcDir, 'components', 'header'), { recursive: true });
  fs.mkdirSync(path.join(srcDir, 'components', 'unused-btn'), { recursive: true });
  fs.mkdirSync(path.join(srcDir, 'bridges'), { recursive: true });

  // Create main.app.js with route mappings
  fs.writeFileSync(
    path.join(srcDir, 'main.app.js'),
    `import { AvenxApp } from 'avenx-core/runtime';
import Header from './components/header/header.component.js';

const app = new AvenxApp({ target: '#app' });
app.register('Header', Header);
app.initRouter({
  '': 'HomePage',
  '/home': 'HomePage',
  '/user/:id': 'UserPage'
});
`
  );

  // Create Pages
  fs.writeFileSync(
    path.join(srcDir, 'pages', 'home.page.js'),
    `<state title="Home" />
<Header />
<div>Home</div>
export class HomePage {}
`
  );

  fs.writeFileSync(
    path.join(srcDir, 'pages', 'user.page.js'),
    `export class UserPage {}`
  );

  // Create Components
  fs.writeFileSync(
    path.join(srcDir, 'components', 'header', 'header.component.js'),
    `export class Header {}`
  );

  fs.writeFileSync(
    path.join(srcDir, 'components', 'unused-btn', 'unused-btn.component.js'),
    `export class UnusedBtn {}`
  );

  // Create Bridge
  fs.writeFileSync(
    path.join(srcDir, 'bridges', 'auth.bridge.js'),
    `export class AuthBridge {}`
  );

  // Capture console.log
  let logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  const fakeCli = {
    baseDir: TEST_DIR,
    config: { srcDir: 'src' },
  };

  runInspect(fakeCli);

  console.log = originalLog;

  const output = logs.join('\n');

  assert.ok(output.includes('📦 Avenx Project Hierarchy (src/)'), 'Header matches expected title');
  assert.ok(output.includes('├── 📄 Pages (2)'), 'Pages category count matches');
  assert.ok(output.includes('│   ├── HomePage (/home) -> src/pages/home.page.js'), 'HomePage route matches');
  assert.ok(output.includes('│   └── UserPage (/user/:id) -> src/pages/user.page.js'), 'UserPage route matches');
  assert.ok(output.includes('├── 🧩 Components (2)'), 'Components category count matches');
  assert.ok(output.includes('│   ├── Header -> src/components/header/header.component.js'), 'Used Header matches');
  assert.ok(!output.includes('Header -> src/components/header/header.component.js (⚠️ Unused)'), 'Header is NOT marked as unused');
  assert.ok(output.includes('│   └── UnusedBtn -> src/components/unused-btn/unused-btn.component.js (⚠️ Unused)'), 'UnusedBtn is marked as (⚠️ Unused)');
  assert.ok(output.includes('└── 🌉 Bridges (1)'), 'Bridges category count matches');
  assert.ok(output.includes('    └── AuthBridge -> src/bridges/auth.bridge.js'), 'AuthBridge matches');

  console.log('✅ Unit test for bin/commands/inspect.js passed successfully!');
} catch (err) {
  console.error('❌ Unit test failed:', err);
  process.exit(1);
} finally {
  cleanup();
}
