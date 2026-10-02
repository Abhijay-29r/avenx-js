import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { CONFIG_SCHEMA } from '../../lib/config.js';
import { runDoctor } from '../../bin/commands/doctor.js';

console.log('Testing avenx doctor nested config validation...');

const originalCwd = process.cwd();
const originalLog = console.log;
const originalExitCode = process.exitCode;

/**
 * Runs doctor against a throwaway project holding the given avenx.config.json.
 * @param {object} config
 * @returns {{ output: string, exitCode: number|undefined }}
 */
function runDoctorOn(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-doctor-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'doctor-test' }));
  // A src directory keeps a clean project at exit code 0, so any change to the
  // exit code below can only come from the config checks.
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'avenx.config.json'), JSON.stringify(config));
  const logs = [];
  let exitCode;
  try {
    // runDoctor takes its root from process.cwd() when package.json is there.
    process.chdir(dir);
    process.exitCode = undefined;
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
    };
    runDoctor({ baseDir: dir, config: {} });
    exitCode = process.exitCode;
  } finally {
    console.log = originalLog;
    process.chdir(originalCwd);
    process.exitCode = originalExitCode;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { output: logs.join('\n'), exitCode };
}

const BOGUS_KEY = '__not_a_real_option__';
const nestedSections = Object.keys(CONFIG_SCHEMA).filter((name) => name !== 'topLevel');

// The sections this issue is about must be in the schema we iterate.
for (const required of ['trace', 'rewind', 'hooks']) {
  assert.ok(nestedSections.includes(required), `CONFIG_SCHEMA should define "${required}"`);
}

// Baseline: a clean config, to compare exit-code behaviour against.
const baseline = runDoctorOn({});
assert.ok(!baseline.exitCode, 'a clean project should pass doctor with exit code 0');

// 1. Every nested section reports an unknown sub-key, and warnings do not change the exit code.
for (const section of nestedSections) {
  const { output, exitCode } = runDoctorOn({ [section]: { [BOGUS_KEY]: true } });
  assert.ok(
    output.includes(`Unrecognized config field "${section}.${BOGUS_KEY}"`),
    `doctor should report an unknown key under "${section}"`,
  );
  assert.strictEqual(exitCode, baseline.exitCode, `an unknown key under "${section}" must stay a warning`);
}

// 2. Every valid key in every nested section is accepted (no false positives).
for (const section of nestedSections) {
  const validSection = Object.fromEntries(CONFIG_SCHEMA[section].map((key) => [key, true]));
  const { output } = runDoctorOn({ [section]: validSection });
  assert.ok(!output.includes('Unrecognized config field'), `valid keys under "${section}" must not be flagged`);
}

// 3. The typos from the issue.
const typos = runDoctorOn({ trace: { maxNode: 5 }, hooks: { prebuidl: 'echo hi' } }).output;
assert.ok(typos.includes('Unrecognized config field "trace.maxNode"'), 'trace.maxNode typo should be reported');
assert.ok(typos.includes('Unrecognized config field "hooks.prebuidl"'), 'hooks.prebuidl typo should be reported');

console.log('doctor nested config validation tests passed.');