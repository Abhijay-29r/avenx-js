import * as prettierHtml from 'prettier/plugins/html';

const AVENX_TAG_PREFIX = 'avenx-';
const AVENX_TAGS = ['css', 'global', 'if', 'elseif', 'else', 'for', 'defer', 'suspense'];

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

function decodeAvenxSyntax(text) {
  let decoded = text;

  for (const tag of AVENX_TAGS) {
    decoded = decoded
      .replaceAll(`<${AVENX_TAG_PREFIX}${tag}`, `<@${tag}`)
      .replaceAll(`</${AVENX_TAG_PREFIX}${tag}>`, `</@${tag}>`);
  }

  decoded = decoded.replaceAll('data-avenx-css', '@css');
  decoded = decoded.replaceAll('data-avenx-click', '@click');

  return decoded;
}

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
    parse(text, options) {
      return htmlParser.parse(encodeAvenxSyntax(text), options);
    },
    astFormat: 'html',
  },
};

export const printers = {
  html: {
    ...htmlPrinter,
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
