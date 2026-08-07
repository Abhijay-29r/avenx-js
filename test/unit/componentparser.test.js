import assert from 'node:assert';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

console.log('🧪 Testing ComponentParser line and column tracking (#810)...');

const html = `<div>\n  <span>Hello</span>\n</div>`;
const nodes = ComponentParser.parseHTML(html);

// 1. Root <div> tag (line 1, col 1)
assert.strictEqual(nodes[0].tagName, 'div', 'Root tag should be div');
assert.strictEqual(nodes[0].line, 1, 'Root <div> should be on line 1');
assert.strictEqual(nodes[0].column, 1, 'Root <div> should be at column 1');

// 2. Nested <span> tag (line 2, col 3)
const spanNode = nodes[0].children.find((c) => c.tagName === 'span');
assert.ok(spanNode, 'span child node should exist');
assert.strictEqual(spanNode.line, 2, 'Nested <span> should be on line 2');
assert.strictEqual(spanNode.column, 3, 'Nested <span> should be at column 3');

console.log('  ✅ Line and column tracking unit tests passed!');