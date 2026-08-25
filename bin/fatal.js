import { red, gray, bold } from './colors.js';

/**
 * Marks the process as failed.
 *
 * `process.exitCode` is set rather than calling `process.exit()`, because
 * `process.exit()` tears the process down immediately and can truncate stdout
 * and stderr that have not flushed yet — which in CI means a build that failed
 * without printing the reason. Setting the code lets Node exit normally once
 * the output has drained.
 * @param {number} [code] - The exit code to fail with.
 */
export function failProcess(code = 1) {
  process.exitCode = code;
}

/**
 * Reports a fatal error and marks the process as failed.
 *
 * Errors carrying an Avenx code (AVX_C03, AVX_W03 and friends) are diagnosed
 * conditions: the message already names the file, explains the problem and
 * often carries a code frame, so it is printed on its own. A stack trace there
 * would only point at the line of the compiler that raised it.
 *
 * Anything else is a bug rather than a diagnosis, so the stack is printed —
 * that is the only useful information such an error carries.
 * @param {Error|any} error - The failure.
 * @param {string} [action] - What was being attempted, for the headline.
 */
export function reportFatal(error, action = 'Build') {
  const isDiagnosed = Boolean(error && typeof error.code === 'string' && error.code.startsWith('AVX_'));

  console.error('');
  console.error(bold(red(`✖ ${action} failed`)));
  console.error('');

  if (isDiagnosed) {
    console.error(red(error.message));
  } else if (error instanceof Error) {
    console.error(red(error.stack || error.message));
  } else {
    console.error(red(String(error)));
  }

  console.error('');
  console.error(gray('The command exits with a non-zero status.'));

  failProcess(1);
}
