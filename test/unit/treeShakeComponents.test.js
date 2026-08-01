import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AvenxCompiler from '../../lib/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Component Tree-Shaking in AvenxCompiler...');

const tempDir = path.join(__dirname, 'temp_treeshake_test');

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  cleanup();

  const srcDir = path.join(tempDir, 'src');
  const compDir = path.join(srcDir, 'components');
  const pageDir = path.join(srcDir, 'pages');

  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(pageDir, { recursive: true });

  // 1. Used components
  // Header component
  fs.writeFileSync(
    path.join(compDir, 'header.component.js'),
    `class Header extends AvenxComponent {}\n<div @css header>Header</div>`,
  );
  fs.writeFileSync(
    path.join(compDir, 'header.component.css'),
    `<@css>\nheader {\n  color: black;\n}\n</@css>`,
  );

  // UserCard component (uses Avatar)
  fs.writeFileSync(
    path.join(compDir, 'user-card.component.js'),
    `import Avatar from './avatar.component.js';\n<div @css card><Avatar /></div>`,
  );
  fs.writeFileSync(
    path.join(compDir, 'user-card.component.css'),
    `<@css>\ncard {\n  border: 1px solid red;\n}\n</@css>`,
  );

  // Avatar component
  fs.writeFileSync(
    path.join(compDir, 'avatar.component.js'),
    `class Avatar extends AvenxComponent {}\n<div @css avatar>Avatar</div>`,
  );
  fs.writeFileSync(
    path.join(compDir, 'avatar.component.css'),
    `<@css>\navatar {\n  width: 50px;\n}\n</@css>`,
  );

  // 2. Unused components (dead code)
  fs.writeFileSync(
    path.join(compDir, 'unused-widget.component.js'),
    `class UnusedWidget extends AvenxComponent {}\n<div @css unused>Unused</div>`,
  );
  fs.writeFileSync(
    path.join(compDir, 'unused-widget.component.css'),
    `<@css>\nunused {\n  display: none;\n}\n</@css>`,
  );

  fs.writeFileSync(
    path.join(compDir, 'dead-button.component.js'),
    `class DeadButton extends AvenxComponent {}\n<div @css dead>Dead</div>`,
  );
  fs.writeFileSync(
    path.join(compDir, 'dead-button.component.css'),
    `<@css>\ndead {\n  background: red;\n}\n</@css>`,
  );

  // 3. Page using Header and UserCard
  fs.writeFileSync(
    path.join(pageDir, 'home.page.js'),
    `<div>\n  <Header />\n  <UserCard />\n</div>`,
  );

  // ----------------------------------------------------
  // Test 1: Tree shaking enabled (default)
  // ----------------------------------------------------
  console.log('  Testing tree-shaking of unused components and styles...');
  const compiler = new AvenxCompiler({ rootDir: tempDir, srcDir: 'src' });
  const compiledJs = compiler.processComponents();
  const compiledCss = compiler.styleProcessor.getGlobalStyles();

  // Used components should be present
  assert.ok(compiledJs.includes('Header'), 'Header component should be compiled');
  assert.ok(compiledJs.includes('UserCard'), 'UserCard component should be compiled');
  assert.ok(compiledJs.includes('Avatar'), 'Transitive dependency Avatar should be compiled');

  // Unused components should be omitted
  assert.ok(!compiledJs.includes('UnusedWidget'), 'UnusedWidget component should be tree-shaken');
  assert.ok(!compiledJs.includes('DeadButton'), 'DeadButton component should be tree-shaken');

  // Styles of unused components should be omitted
  assert.ok(compiledCss.includes('color: black'), 'Header styles should be included');
  assert.ok(compiledCss.includes('border: 1px solid red'), 'UserCard styles should be included');
  assert.ok(compiledCss.includes('width: 50px'), 'Avatar styles should be included');
  assert.ok(!compiledCss.includes('display: none'), 'UnusedWidget styles should be tree-shaken');
  assert.ok(!compiledCss.includes('background: red'), 'DeadButton styles should be tree-shaken');

  console.log('  ✅ Tree-shaking of unused components and styles verified!');

  // ----------------------------------------------------
  // Test 2: Kebab-case tag references in templates
  // ----------------------------------------------------
  console.log('  Testing kebab-case tag references (<user-card />)...');
  fs.writeFileSync(
    path.join(pageDir, 'home.page.js'),
    `<div>\n  <user-card />\n</div>`,
  );

  const compilerKebab = new AvenxCompiler({ rootDir: tempDir, srcDir: 'src' });
  const compiledKebabJs = compilerKebab.processComponents();

  assert.ok(compiledKebabJs.includes('UserCard'), 'UserCard should be recognized from <user-card />');
  assert.ok(compiledKebabJs.includes('Avatar'), 'Avatar should be transitively included');
  assert.ok(!compiledKebabJs.includes('Header'), 'Header should be omitted when not referenced');

  console.log('  ✅ Kebab-case tag references verified!');

  // ----------------------------------------------------
  // Test 3: Disabling tree-shaking via config
  // ----------------------------------------------------
  console.log('  Testing treeShakeComponents: false config option...');
  const compilerNoShake = new AvenxCompiler({
    rootDir: tempDir,
    srcDir: 'src',
    treeShakeComponents: false,
  });
  const compiledNoShakeJs = compilerNoShake.processComponents();

  assert.ok(compiledNoShakeJs.includes('Header'), 'Header should be included');
  assert.ok(compiledNoShakeJs.includes('UserCard'), 'UserCard should be included');
  assert.ok(compiledNoShakeJs.includes('Avatar'), 'Avatar should be included');
  assert.ok(compiledNoShakeJs.includes('UnusedWidget'), 'UnusedWidget should be included when treeShakeComponents: false');
  assert.ok(compiledNoShakeJs.includes('DeadButton'), 'DeadButton should be included when treeShakeComponents: false');

  console.log('  ✅ Disabling tree-shaking option verified!');

  cleanup();
  console.log('🎉 All Component Tree-Shaking tests passed successfully!');
} catch (err) {
  cleanup();
  console.error('❌ Test failed:', err);
  process.exit(1);
}
