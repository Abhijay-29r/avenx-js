const parser = {
  meta: {
    name: 'avenx-template-parser',
    version: '0.4.3',
  },

  parse(text, options = {}) {
    const lines = text.split(/\r\n|\r|\n/);
    const lastLine = lines.length;
    const lastColumn = lines[lastLine - 1].length;

    return {
      type: 'Program',
      body: [],
      sourceType: options.sourceType || 'module',
      comments: [],
      tokens: [],
      range: [0, text.length],
      loc: {
        start: {
          line: 1,
          column: 0,
        },
        end: {
          line: lastLine,
          column: lastColumn,
        },
      },
    };
  },
};

export default parser;