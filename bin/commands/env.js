import fs from 'fs';
import path from 'path';
import { loadEnv, parseEnv } from '../../lib/env.js';
import { bold, cyan, green, yellow, gray } from '../colors.js';

/**
 * Masks a secret value for display (e.g. secr****).
 * @param {string} value
 * @returns {string}
 */
function maskSecret(value) {
  const str = String(value ?? '');
  if (str.length <= 4) {
    return '*'.repeat(Math.max(str.length, 4));
  }
  return `${str.slice(0, 4)}${'*'.repeat(Math.min(8, str.length - 4))}`;
}

/**
 * Pads a string to a fixed width for table-like output.
 * @param {string} value
 * @param {number} width
 * @returns {string}
 */
function pad(value, width) {
  const s = String(value ?? '');
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

/**
 * Reads .env keys that were defined in the project file (if present).
 * @param {string} rootDir
 * @returns {{ path: string|null, keys: string[], exists: boolean, error: string|null }}
 */
function readEnvFileMeta(rootDir) {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    return { path: null, keys: [], exists: false, error: null };
  }
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const parsed = parseEnv(content);
    return { path: envPath, keys: Object.keys(parsed), exists: true, error: null };
  } catch (err) {
    return {
      path: envPath,
      keys: [],
      exists: true,
      error: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Prints active environment configuration (public vs private).
 * @param {{ baseDir: string }} cli
 * @param {string[]} [_args]
 */
export function runEnv(cli, _args = []) {
  const rootDir = cli.baseDir || process.cwd();
  loadEnv(rootDir);

  const meta = readEnvFileMeta(rootDir);
  const fileKeys = new Set(meta.keys);
  const publicKeys = new Set();
  const systemKeys = new Set();

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('AVX_PUBLIC_')) {
      publicKeys.add(key);
    }
  }
  for (const key of fileKeys) {
    if (key.startsWith('AVX_PUBLIC_')) {
      publicKeys.add(key);
    } else {
      systemKeys.add(key);
    }
  }

  console.log(`\n${bold(cyan('Avenx Environment'))}`);
  console.log(`${gray('Project:')} ${rootDir}\n`);

  console.log(bold(cyan('Source Files')));
  if (!meta.exists) {
    console.log(`  ${yellow('⚠')} No .env file found (only process env AVX_PUBLIC_* shown)`);
  } else if (meta.error) {
    console.log(`  ${yellow('✖')} Failed to read ${meta.path}: ${meta.error}`);
    process.exitCode = 1;
  } else {
    console.log(`  ${green('✔')} ${meta.path}`);
  }
  console.log();

  const pubList = [...publicKeys].sort();
  console.log(bold(cyan('Public Variables')) + gray(' (AVX_PUBLIC_* — inlined at build time)'));
  if (pubList.length === 0) {
    console.log(`  ${gray('(none)')}`);
  } else {
    console.log(`  ${pad('Key', 28)} ${pad('Value', 24)} Notes`);
    for (const key of pubList) {
      const value = process.env[key] ?? '';
      const note = value === '' ? yellow('empty') : gray('inlined');
      console.log(`  ${pad(key, 28)} ${pad(value, 24)} ${note}`);
    }
  }
  console.log();

  const sysList = [...systemKeys].sort();
  console.log(bold(cyan('System Variables')) + gray(' (from .env — values masked)'));
  if (sysList.length === 0) {
    console.log(`  ${gray('(none)')}`);
  } else {
    console.log(`  ${pad('Key', 28)} Value`);
    for (const key of sysList) {
      const value = process.env[key] ?? '';
      console.log(`  ${pad(key, 28)} ${maskSecret(value)}`);
    }
  }
  console.log();
}
