import path from 'node:path';

const VLQ_BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encodes an integer value to a VLQ Base64 string.
 * @param {number} value
 * @returns {string}
 */
export function encodeVLQ(value) {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let encoded = '';
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 32;
    }
    encoded += VLQ_BASE64_CHARS[digit];
  } while (vlq > 0);
  return encoded;
}

/**
 * Generates a Source Map v3 object mapping compiled JavaScript lines to original template source lines.
 * @param {string} filePath - File path of the source template (.html, .avx, .component.js, .page.js).
 * @param {string} originalCode - Raw template source code.
 * @param {string} compiledCode - Compiled and wrapped ES module JavaScript code.
 * @returns {object} Source Map v3 compliant object.
 */
export function generateTemplateSourceMap(filePath, originalCode, compiledCode) {
  const origLines = (originalCode || '').split(/\r?\n/);
  const genLines = (compiledCode || '').split(/\r?\n/);

  let stateLine = 0;
  const actionLines = new Map();
  const computedLines = new Map();
  const resourceLines = new Map();

  origLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/<state\b/i.test(trimmed) && stateLine === 0) {
      stateLine = idx;
    }

    const actionMatch = line.match(/<action\s+[^>]*name=["']([\w-]+)["']/i);
    if (actionMatch) {
      actionLines.set(actionMatch[1], idx);
    }

    const computedMatch = line.match(/<computed\s+[^>]*name=["']([\w-]+)["']/i);
    if (computedMatch) {
      computedLines.set(computedMatch[1], idx);
    }

    const resourceMatch = line.match(/<resource\s+[^>]*name=["']([\w-]+)["']/i);
    if (resourceMatch) {
      resourceLines.set(resourceMatch[1], idx);
    }
  });

  const lineMappings = new Array(genLines.length).fill(null);

  genLines.forEach((genLine, gIdx) => {
    const trimmedGen = genLine.trim();

    if (trimmedGen.startsWith('constructor(') || trimmedGen.startsWith('super(')) {
      lineMappings[gIdx] = stateLine;
      return;
    }

    for (const [actionName, startLine] of actionLines.entries()) {
      if (genLine.includes(`${actionName}:`) || genLine.includes(`"${actionName}":`) || genLine.includes(`'${actionName}':`)) {
        lineMappings[gIdx] = startLine;
        return;
      }
    }

    for (const [compName, startLine] of computedLines.entries()) {
      if (genLine.includes(`${compName}:`) || genLine.includes(`"${compName}":`) || genLine.includes(`'${compName}':`)) {
        lineMappings[gIdx] = startLine;
        return;
      }
    }

    for (const [resName, startLine] of resourceLines.entries()) {
      if (genLine.includes(`${resName}:`) || genLine.includes(`"${resName}":`) || genLine.includes(`'${resName}':`)) {
        lineMappings[gIdx] = startLine;
        return;
      }
    }

    if (trimmedGen.length > 0) {
      let matchedOrigLine = -1;
      const cleanGen = trimmedGen.replace(/^`|`\s*,?$|^`|`$/g, '').trim();

      if (cleanGen.length > 0) {
        for (let oIdx = 0; oIdx < origLines.length; oIdx++) {
          const origTrimmed = origLines[oIdx].trim();
          if (
            origTrimmed.length > 0 &&
            (origTrimmed === cleanGen || origTrimmed.includes(cleanGen) || cleanGen.includes(origTrimmed))
          ) {
            matchedOrigLine = oIdx;
            break;
          }
        }
      }

      if (matchedOrigLine !== -1) {
        lineMappings[gIdx] = matchedOrigLine;
        return;
      }
    }

    if (gIdx > 0 && gIdx < genLines.length - 1) {
      lineMappings[gIdx] = stateLine;
    } else {
      lineMappings[gIdx] = 0;
    }
  });

  let mappings = '';
  let prevSourceLine = 0;
  let prevSourceCol = 0;
  let prevSourceIdx = 0;

  for (let g = 0; g < genLines.length; g++) {
    if (g > 0) {
      mappings += ';';
    }

    const origLine0 = lineMappings[g];
    if (origLine0 !== null && origLine0 !== undefined) {
      const genCol = 0;
      const sourceIdx = 0;
      const origCol0 = 0;

      const dGenCol = genCol;
      const dSourceIdx = sourceIdx - prevSourceIdx;
      const dSourceLine = origLine0 - prevSourceLine;
      const dSourceCol = origCol0 - prevSourceCol;

      mappings += encodeVLQ(dGenCol) + encodeVLQ(dSourceIdx) + encodeVLQ(dSourceLine) + encodeVLQ(dSourceCol);

      prevSourceIdx = sourceIdx;
      prevSourceLine = origLine0;
      prevSourceCol = origCol0;
    }
  }

  const fileName = path.basename(filePath);

  return {
    version: 3,
    file: fileName,
    sources: [filePath],
    sourcesContent: [originalCode],
    names: [],
    mappings: mappings,
  };
}
