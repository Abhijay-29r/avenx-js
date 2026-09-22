import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function runFormat(cli) {
  console.log('Formatting project files...');

  try {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const pluginPath = path.join(cli.frameworkDir, 'lib', 'core', 'tooling', 'prettierPlugin.js');

    execFileSync(
      command,
      [
        'prettier',
        '--plugin',
        pluginPath,
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
      }
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
