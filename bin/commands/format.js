import { execFileSync } from 'node:child_process';

export function runFormat() {
  console.log('Formatting project files...');

  try {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    execFileSync(
      command,
      ['prettier', '--write', '**/*.js', '**/*.md', '**/*.json'],
      {
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
