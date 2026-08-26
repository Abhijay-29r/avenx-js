/**
 * Structured diagnostic catalogue mapping stable error and warning codes
 * to detailed descriptions, causes, remedies, and documentation links.
 */
export const DIAGNOSTIC_CATALOGUE = {
  // Compiler Diagnostics (AVX_C01 - AVX_C06)
  AVX_C01: {
    code: 'AVX_C01',
    name: 'InvalidTemplateSyntax',
    severity: 'error',
    category: 'compiler',
    summary: 'The component template contains invalid syntax or unclosed tags.',
    causes: [
      'A tag was opened but not properly closed.',
      'Malformed directive attributes or expression syntax.'
    ],
    remedies: [
      'Check template markup for balanced tags.',
      'Ensure directives use valid syntax (e.g., <@for ...>).'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c01'
  },
  AVX_C02: {
    code: 'AVX_C02',
    name: 'DuplicateActionDefinition',
    severity: 'error',
    category: 'compiler',
    summary: 'An action name was defined more than once within the same component.',
    causes: [
      'Two <action name="..."> blocks share the same name identifier.'
    ],
    remedies: [
      'Rename or merge duplicate action definitions.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c02'
  },
  AVX_C03: {
    code: 'AVX_C03',
    name: 'UndefinedStateReference',
    severity: 'error',
    category: 'compiler',
    summary: 'A state variable referenced in the template or action is not declared.',
    causes: [
      'Referencing a variable not defined in <state /> declarations.'
    ],
    remedies: [
      'Declare the missing state variable in <state varName="..." />.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c03'
  },
  AVX_C04: {
    code: 'AVX_C04',
    name: 'InvalidDirectiveUsage',
    severity: 'error',
    category: 'compiler',
    summary: 'A framework directive is used in an invalid context.',
    causes: [
      'Placing directives where they cannot be evaluated or nesting incompatible directives.'
    ],
    remedies: [
      'Check the directive reference documentation for allowable parent-child relationships.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c04'
  },
  AVX_C05: {
    code: 'AVX_C05',
    name: 'MissingRootElement',
    severity: 'error',
    category: 'compiler',
    summary: 'Component template markup lacks a valid root container element.',
    causes: [
      'Template root has multiple adjacent unparented nodes without a fragment wrapper.'
    ],
    remedies: [
      'Wrap root template content inside a single container element or fragment.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c05'
  },
  AVX_C06: {
    code: 'AVX_C06',
    name: 'MalformedExpression',
    severity: 'error',
    category: 'compiler',
    summary: 'An expression enclosed in {{ ... }} failed interpolation parsing.',
    causes: [
      'JavaScript syntax error inside template expression interpolation delimiters.'
    ],
    remedies: [
      'Ensure interpolation contains valid JavaScript expressions.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-c06'
  },

  // Runtime Diagnostics (AVX_R01 - AVX_R18)
  AVX_R01: {
    code: 'AVX_R01',
    name: 'ComponentMountFailure',
    severity: 'error',
    category: 'runtime',
    summary: 'The target DOM element for component mounting was not found.',
    causes: [
      'The selector passed to app.mount() does not exist in the DOM when called.'
    ],
    remedies: [
      'Ensure the selector exists in index.html before mounting or call after DOMContentLoaded.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-r01'
  },
  AVX_R08: {
    code: 'AVX_R08',
    name: 'UncaughtRenderError',
    severity: 'error',
    category: 'runtime',
    summary: 'An unhandled exception occurred during component render cycle.',
    causes: [
      'Accessing properties of undefined/null during reactive re-rendering.'
    ],
    remedies: [
      'Use optional chaining or default values for nullable reactive properties.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-r08'
  },
  AVX_R18: {
    code: 'AVX_R18',
    name: 'ReactivityLoopDetected',
    severity: 'error',
    category: 'runtime',
    summary: 'A circular reactive update loop exceeded the maximum update depth limit.',
    causes: [
      'An action or effect synchronously mutates state that triggers itself continuously.'
    ],
    remedies: [
      'Break recursive mutations or add termination conditions to reactive watchers.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-r18'
  },

  // Warning Diagnostics (AVX_W01 - AVX_W35)
  AVX_W01: {
    code: 'AVX_W01',
    name: 'UnusedStateVariable',
    severity: 'warning',
    category: 'compiler',
    summary: 'A state variable was declared but never referenced in template or actions.',
    causes: [
      '<state ... /> defines a variable that is dead code.'
    ],
    remedies: [
      'Remove unused state declarations to reduce memory footprint.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-w01'
  },
  AVX_W29: {
    code: 'AVX_W29',
    name: 'MissingKeyInLoop',
    severity: 'warning',
    category: 'compiler',
    summary: 'A repeated list item in <@for> does not specify a unique @key attribute.',
    causes: [
      '<@for ...> rendering dynamic lists without unique tracking keys.'
    ],
    remedies: [
      'Add a unique @key attribute to the root repeated item (e.g., @key="item.id").'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-w29'
  },
  AVX_W35: {
    code: 'AVX_W35',
    name: 'DeprecatedLifecycleHook',
    severity: 'warning',
    category: 'runtime',
    summary: 'A deprecated lifecycle method was invoked on the component instance.',
    causes: [
      'Using legacy lifecycle methods slated for deprecation.'
    ],
    remedies: [
      'Migrate to updated lifecycle hooks as specified in the migration guide.'
    ],
    docsUrl: 'https://avenx.dev/docs/troubleshooting#avx-w35'
  }
};

/**
 * Normalizes input code string to standard format (e.g. 'c01', 'avx_c01' -> 'AVX_C01').
 * @param {string} code
 * @returns {string}
 */
export function normalizeCode(code = '') {
  const clean = code.trim().toUpperCase();
  if (clean.startsWith('AVX_')) return clean;
  if (clean.startsWith('AVX')) return `AVX_${clean.slice(3)}`;
  return `AVX_${clean}`;
}

/**
 * Looks up an entry from the catalogue.
 * @param {string} code
 * @returns {object|null}
 */
export function getDiagnostic(code) {
  const normalized = normalizeCode(code);
  return DIAGNOSTIC_CATALOGUE[normalized] || null;
}

/**
 * Suggests near matches for an unknown code.
 * @param {string} inputCode
 * @returns {string[]}
 */
export function suggestCodes(inputCode) {
  const normalized = normalizeCode(inputCode);
  return Object.keys(DIAGNOSTIC_CATALOGUE).filter((k) => {
    return (
      k.includes(normalized) ||
      k.replace('AVX_', '').includes(normalized.replace('AVX_', ''))
    );
  });
}
