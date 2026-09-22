import * as prettierHtml from 'prettier/plugins/html';

const AVENX_TAG_PREFIX = 'avenx-';
const AVENX_TAGS = ['css', 'global', 'if', 'elseif', 'else', 'for', 'defer', 'suspense'];

/**
 * Encodes Avenx-specific template syntax into HTML-compatible syntax.
 *
 * @param {string} text - The Avenx template source.
 * @returns {string} HTML-compatible source.
 */
function encodeAvenxSyntax(text) {
  let encoded = text;

  for (const tag of AVENX_TAGS) {
    encoded = encoded
      .replaceAll(`<@${tag}`, `<${AVENX_TAG_PREFIX}${tag}`)
      .replaceAll(`</@${tag}>`, `</${AVENX_TAG_PREFIX}${tag}>`);
  }

  encoded = encoded.replaceAll('@css', 'data-avenx-css');
  encoded = encoded.replaceAll('@click', 'data-avenx-click');

  return encoded;
}

/**
 * Restores Avenx-specific syntax in a parsed HTML AST.
 *
 * @param {object} node - The AST node to restore.
 * @returns {void}
 */
function restoreAvenxNode(node) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (typeof node.name === 'string' && node.name.startsWith(AVENX_TAG_PREFIX)) {
    node.name = `@${node.name.slice(AVENX_TAG_PREFIX.length)}`;
  }

  if (Array.isArray(node.attrs)) {
    for (const attribute of node.attrs) {
      if (attribute?.name === 'data-avenx-css') {
        attribute.name = '@css';
      } else if (attribute?.name === 'data-avenx-click') {
        attribute.name = '@click';
      }
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach(restoreAvenxNode);
      } else {
        restoreAvenxNode(value);
      }
    }
  }
}

const htmlParser = prettierHtml.parsers.html;
const htmlPrinter = prettierHtml.printers.html;

export const languages = [
  {
    name: 'Avenx Template',
    parsers: ['avenx-template'],
    extensions: ['.component.js', '.page.js'],
    filenames: [],
  },
];

export const parsers = {
  'avenx-template': {
    ...htmlParser,

    /**
     * Parses an Avenx template using Prettier's HTML parser.
     *
     * @param {string} text - The Avenx template source.
     * @param {object} options - Prettier parser options.
     * @returns {object} Parsed HTML AST.
     */
    parse(text, options) {
      return htmlParser.parse(encodeAvenxSyntax(text), options);
    },

    astFormat: 'html',
  },
};

export const printers = {
  html: {
    ...htmlPrinter,

    /**
     * Restores Avenx syntax before the HTML printer formats the AST.
     *
     * @param {object} ast - The parsed template AST.
     * @returns {object} Restored Avenx AST.
     */
    preprocess(ast) {
      restoreAvenxNode(ast);
      return ast;
    },
  },
};

export default {
  languages,
  parsers,
  printers,
};
