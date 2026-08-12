import fs from 'fs';
import path from 'path';
import AvenxCompiler from '../../lib/compiler.js';

/**
 * Runs the compiler build.
 * @param {object} cli - AvenxCLI instance containing config and baseDir.
 */
export function buildProject(cli) {
  new AvenxCompiler(cli.config).build();
}

/**
 * Cleans the project by deleting the build output directory.
 * @param {object} cli - AvenxCLI instance containing config and baseDir.
 */
export function cleanProject(cli) {
  const distDir = path.join(cli.baseDir, cli.config.distDir);
  if (fs.existsSync(distDir)) {
    console.log(`🧹 Cleaning build output directory: ${cli.config.distDir}...`);
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('✅ Clean complete.');
  } else {
    console.log(`🧹 Build output directory ${cli.config.distDir} does not exist. Nothing to clean.`);
  }
}

/**
 * Strips ANSI color escape codes from a message string.
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  if (typeof str !== 'string') return String(str || '');
  const ansiPattern = '(?:\\u001b|\\u009b)[[(#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nseries]';
  const ansiRegex = new RegExp(ansiPattern, 'g');
  return str.replace(ansiRegex, '').trim();
}

/**
 * Parses raw diagnostic inputs into a structured object.
 * @param {string} severity - 'warning' or 'error'
 * @param {any[]} args - Log or error arguments
 * @returns {object} Diagnostic object
 */
export function parseDiagnostic(severity, args) {
  let file = null;
  let code = null;
  let rawMsg;

  const firstArg = args && args[0];
  if (firstArg instanceof Error) {
    rawMsg = firstArg.message || String(firstArg);
    if (firstArg.code) code = firstArg.code;
    if (firstArg.filePath || firstArg.fileName || firstArg.file) {
      file = firstArg.filePath || firstArg.fileName || firstArg.file;
    }
  } else if (Array.isArray(args)) {
    rawMsg = args.map((a) => (typeof a === 'object' && a !== null ? (a.message || JSON.stringify(a)) : String(a))).join(' ');
  } else {
    rawMsg = String(args || '');
  }

  rawMsg = stripAnsi(rawMsg);

  // Extract error code if not found on error object
  if (!code) {
    const codeMatch = rawMsg.match(/\[?(AVX_[A-Z0-9]+)\]?/);
    if (codeMatch) {
      code = codeMatch[1];
    }
  }

  // Extract file path/name if not found on error object
  if (!file) {
    const fileMatch =
      rawMsg.match(/in template of\s+["']?([^"'\s]+\.[a-zA-Z0-9]+)["']?/i) ||
      rawMsg.match(/in component\s+<([^>]+)>/i) ||
      rawMsg.match(/at\s+["']?([^"'\s]+\.[a-zA-Z0-9]+)["']?/i) ||
      rawMsg.match(/["']?([a-zA-Z0-9_\-/\\]+\.(?:js|component\.js|page\.js|html|json))["']?/i);

    if (fileMatch) {
      file = fileMatch[1];
    }
  }

  // Strip leading code bracket like "[AVX_W03] " from clean message
  let cleanMessage = rawMsg;
  if (code) {
    cleanMessage = cleanMessage.replace(new RegExp(`^\\[?${code}\\]?\\s*:?\\s*`), '');
  }

  return {
    file: file || null,
    code: code || 'AVX_UNK',
    severity: severity === 'error' ? 'error' : 'warning',
    message: cleanMessage.trim(),
  };
}

/**
 * Helper to get formatted local time string for timestamps (HH:MM:SS format).
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Runs a single template check pass and returns structured results.
 * @param {object} cli - AvenxCLI instance containing config and baseDir.
 * @param {string[]} [args] - Command line arguments.
 * @returns {{ valid: boolean, errorCount: number, warningCount: number, diagnostics: any[] }}
 */
export function runCheckPass(cli, args = []) {
  const isJson = args.includes('--json') || args.includes('-j');
  const diagnostics = [];

  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalTrace = console.trace;

  let warningCount = 0;
  let errorCount = 0;

  if (isJson) {
    console.warn = (...messages) => {
      warningCount++;
      diagnostics.push(parseDiagnostic('warning', messages));
    };

    console.error = (...messages) => {
      errorCount++;
      diagnostics.push(parseDiagnostic('error', messages));
    };

    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.trace = () => {};
  } else {
    console.warn = (...messages) => {
      warningCount++;
      originalWarn(...messages);
    };

    console.error = (...messages) => {
      errorCount++;
      originalError(...messages);
    };
  }

  try {
    const compiler = new AvenxCompiler(cli.config);
    compiler.processComponents();
    compiler.processPages();
  } catch (err) {
    errorCount++;
    if (isJson) {
      diagnostics.push(parseDiagnostic('error', [err]));
    } else {
      originalError(`❌ ${err.message || err}`);
    }
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
    console.log = originalLog;
    console.info = originalInfo;
    console.debug = originalDebug;
    console.trace = originalTrace;
  }

  return {
    valid: errorCount === 0 && warningCount === 0,
    errorCount,
    warningCount,
    diagnostics,
  };
}

/**
 * Validates template files without building.
 * Supports --watch / -w for continuous watching and template linting.
 * @param {object} cli - AvenxCLI instance containing config and baseDir.
 * @param {string[]} [args] - Additional command line arguments.
 * @returns {object|fs.FSWatcher|undefined} Diagnostic report or watcher instance.
 */
export function checkProject(cli, args = []) {
  const isJson = args.includes('--json') || args.includes('-j');
  const isWatch = args.includes('--watch') || args.includes('-w');

  if (isWatch) {
    const srcDir = (cli && cli.config && cli.config.srcDir) || 'src';
    const srcPath = path.join((cli && cli.baseDir) || process.cwd(), srcDir);

    console.log(`[${getTimestamp()}] 👀 Watching for template changes in ${srcDir}/...`);

    const executeCheck = () => {
      const timestamp = getTimestamp();
      const report = runCheckPass(cli, args);

      if (isJson) {
        const jsonReport = {
          timestamp,
          ...report,
        };
        console.log(JSON.stringify(jsonReport, null, 2));
      } else {
        const totalIssues = report.warningCount + report.errorCount;
        if (totalIssues > 0) {
          console.error(`[${timestamp}] ❌ Found ${totalIssues} validation issue(s).`);
        } else {
          console.log(`[${timestamp}] ✓ No template validation issues found.`);
        }
      }
      return report;
    };

    // Initial check
    const initialReport = executeCheck();

    if (!fs.existsSync(srcPath)) {
      console.error(`❌ Source directory does not exist: ${srcPath}`);
      return initialReport;
    }

    let timeout;
    const watcher = fs.watch(srcPath, { recursive: true }, (eventType, filename) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const fileMsg = filename ? ` in ${filename}` : '';
        console.log(`\n[${getTimestamp()}] 📄 Change detected${fileMsg}. Re-checking templates...`);
        executeCheck();
      }, 100);
    });


    const cleanup = () => {
      console.log('\nStopping template check watcher...');
      if (watcher) watcher.close();
      if (!cli || !cli._noExit) {
        process.exit(0);
      }
    };

    process.on('SIGINT', cleanup);

    if (cli) {
      cli._watcher = watcher;
    }

    return watcher;
  }

  // Single-pass mode
  const report = runCheckPass(cli, args);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));

    process.exitCode = report.valid ? 0 : 1;
    if (!cli || !cli._noExit) {
      process.exit(process.exitCode);
    }
    return report;
  }

  const totalIssues = report.warningCount + report.errorCount;
  if (totalIssues > 0) {
    console.error(`\nFound ${totalIssues} validation issue(s).`);
    process.exitCode = 1;
    if (!cli || !cli._noExit) {
      process.exit(1);
    }
    return report;
  }

  console.log('✓ No template validation issues found.');
  process.exitCode = 0;
  if (!cli || !cli._noExit) {
    process.exit(0);
  }
  return report;
}


