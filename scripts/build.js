import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Ensure dist directory exists
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

async function build() {
  console.log('Building Avenx runtime...');
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'lib/core/index.js')],
    bundle: true,
    outfile: path.join(distDir, 'runtime.js'),
    format: 'iife',
    globalName: 'Avenx',
    plugins: [
      {
        name: 'node-builtins-stub',
        setup(build) {
          build.onResolve({ filter: /^(fs|path|node:fs|node:path)$/ }, (args) => {
            return { path: args.path, namespace: 'node-stub' };
          });
          build.onLoad({ filter: /.*/, namespace: 'node-stub' }, (args) => {
            if (args.path.includes('path')) {
              return {
                contents: `
                  export function basename(p, ext) {
                    let b = String(p).replace(/^.*[/\\\\]/, '');
                    if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
                    return b;
                  }
                  export function resolve(...pts) { return pts.join('/'); }
                  export function join(...pts) { return pts.join('/'); }
                  export function dirname(p) { return String(p).replace(/[/\\\\][^/\\\\]*$/, ''); }
                  export function isAbsolute(p) { return p.startsWith('/') || /^[a-zA-Z]:/.test(p); }
                  export function relative(from, to) { return to; }
                  export default { basename, resolve, join, dirname, isAbsolute, relative };
                `,
              };
            }
            return {
              contents: `
                export function existsSync() { return false; }
                export function statSync() { return { isDirectory: () => false }; }
                export function readdirSync() { return []; }
                export function readFileSync() { return ''; }
                export default { existsSync, statSync, readdirSync, readFileSync };
              `,
            };
          });
        },
      },
    ],
    footer: {
      js: `
if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, Avenx);
} else if (typeof window !== 'undefined') {
  Object.assign(window, Avenx);
} else if (typeof global !== 'undefined') {
  Object.assign(global, Avenx);
}
`,
    },
    target: ['es2020'],
  });
  console.log('Runtime build successful: dist/runtime.js');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
