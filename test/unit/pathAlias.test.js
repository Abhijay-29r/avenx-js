import assert from 'node:assert';
import path from 'path';
import { resolvePathAlias } from '../../lib/config.js';

console.log('🧪 Testing Path Alias Resolution (#821)...');

const mockConfig = {
  alias: {
    '@': './src',
    '@components': './src/components'
  }
};
const mockRootDir = '/workspace/project';

// Test `@/` mapping
const resolved1 = resolvePathAlias('@/components/Header.js', mockConfig, mockRootDir);
assert.strictEqual(resolved1, path.normalize('/workspace/project/src/components/Header.js'));

// Test custom alias mapping
const resolved2 = resolvePathAlias('@components/Button.js', mockConfig, mockRootDir);
assert.strictEqual(resolved2, path.normalize('/workspace/project/src/components/Button.js'));

// Test relative path remains untouched
const resolved3 = resolvePathAlias('./relative/path.js', mockConfig, mockRootDir);
assert.strictEqual(resolved3, './relative/path.js');

console.log('  ✅ Path Alias unit tests passed!');