import { bold, cyan, green, gray } from '../colors.js';

/**
 * Prints the help message with available commands to the console.
 */
export function printHelp() {
  console.log(`
${bold(cyan('Avenx-JS CLI'))}
${bold('Usage:')} ${green('avenx')} ${gray('<command> [type] [name]')}

${bold(cyan('Commands:'))}
  ${green('init')}                      ${gray('Initialize a new Avenx project structure')}
  ${green('generate component <name>')} ${gray('Generate a new component (alias: g)')}
  ${green('generate page <name>')}      ${gray('Generate a new page (alias: g p)')}
  ${green('generate bridge <name>')}    ${gray('Generate a new shared reactive bridge')}
  ${green('generate guard <name>')}     ${gray('Generate a new route guard')}
  ${green('destroy component <name>')}  ${gray('Delete a component and its registrations (alias: d)')}
  ${green('destroy page <name>')}       ${gray('Delete a page (alias: d p)')}
  ${green('destroy bridge <name>')}     ${gray('Delete a shared reactive bridge')}
  ${green('destroy guard <name>')}      ${gray('Delete a route guard')}
  ${green('build (b)')}                 ${gray('Build the project using configured output directory')}
  ${green('clean')}                     ${gray('Clear build output directory')}
  ${green('check (lint)')}              ${gray('Validate templates without building')}
  ${green('doctor')}                    ${gray('Diagnose environment, config, and project health')}
  ${green('env')}                       ${gray('Print and validate active environment variables')}
  ${green('inspect (i)')}               ${gray('Inspect project route and component hierarchy')}
  ${green('stats (s)')}                ${gray('Display component & bundle footprint metrics')}
  ${green('serve [port]')}              ${gray('Start dev server with hot-reload (default: 3000)')}
  ${green('watch (w)')}                 ${gray('Watch for file changes and rebuild automatically')}
  ${green('help')}                      ${gray('Show this help message')}

${bold(cyan('Options:'))}
  ${green('--dry-run, -d')}             ${gray('Preview actions without writing or deleting any files')}
  ${green('--template, -t <name>')}     ${gray('Use a custom scaffold template for code generation')}
  ${green('--json, -j')}                ${gray('Output check/lint validation diagnostics in JSON format')}
  ${green('--watch, -w')}               ${gray('Watch project component files for continuous template linting')}
  ${green('--no-color')}                ${gray('Disable colored output (the NO_COLOR variable is honored too)')}
  ${green('--version, -v')}             ${gray('Output the current version')}
    `);
}
