import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves the Prettier entry point to run with the current Node binary.
 *
 * `npx prettier` is not spawnable portably: Node refuses to spawn `.cmd`
 * files without a shell (the CVE-2024-27980 hardening), so
 * `execFileSync('npx.cmd', ..., { shell: false })` fails with EINVAL on
 * Windows, and `shell: true` would concatenate the glob arguments unescaped.
 * Running Prettier's entry point with the same Node binary that is running
 * the CLI sidesteps both and works on every platform.
 *
 * The project's own Prettier wins when it has one, so a project can pin a
 * different version than the framework; otherwise the framework's own
 * dependency is used, which is the version the plugin is developed against.
 * @param {string} baseDir - The project directory Prettier runs against.
 * @param {string} frameworkDir - The framework installation directory.
 * @returns {string} Absolute path to Prettier's entry point.
 */
function resolvePrettierBin(baseDir, frameworkDir) {
  const localBin = path.join(baseDir, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  const frameworkBin = path.join(frameworkDir, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  return fs.existsSync(localBin) ? localBin : frameworkBin;
}

/**
 * Formats the project's source files with Prettier.
 *
 * The glob list names every file kind an Avenx project may contain, and a
 * project is free to contain only some of them -- a blank scaffold has no
 * components, no pages, no CSS and no Markdown. Prettier treats a glob that
 * matches nothing as an error and exits non-zero, so without the flag below
 * `avenx format` fails in CI and pre-commit hooks on any project that happens
 * to lack one of these file kinds, while reporting "Formatting failed" over a
 * run that formatted everything it found. `--no-error-on-unmatched-pattern`
 * makes Prettier skip the empty globs instead; a glob that matches files is
 * still formatted, and a genuine failure -- a syntax error, a plugin crash --
 * still exits non-zero through the status propagation below.
 * @param {object} cli - AvenxCLI instance containing baseDir and frameworkDir.
 * @returns {void}
 */
export function runFormat(cli) {
  console.log('Formatting project files...');

  try {
    const pluginPath = path.join(cli.frameworkDir, 'lib', 'core', 'tooling', 'prettierPlugin.js');

    execFileSync(
      process.execPath,
      [
        resolvePrettierBin(cli.baseDir, cli.frameworkDir),
        '--plugin',
        pluginPath,
        '--no-error-on-unmatched-pattern',
        '--write',
        'src/**/*.component.js',
        'src/**/*.page.js',
        'src/**/*.css',
        '**/*.js',
        '**/*.md',
        '**/*.json',
      ],
      {
        cwd: cli.baseDir,
        stdio: 'inherit',
        shell: false,
      },
    );

    console.log('Formatting completed successfully.');
  } catch (error) {
    console.error('Formatting failed.');

    if (error?.status !== undefined) {
      process.exitCode = error.status || 1;
    } else {
      process.exitCode = 1;
    }
  }
}
