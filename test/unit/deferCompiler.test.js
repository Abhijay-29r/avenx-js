import test from 'node:test';
import assert from 'node:assert';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

test('ComponentParser <@defer> tag compilation', async (t) => {
  const parser = new ComponentParser();

  await t.test('compiles default <@defer> (idle trigger) without sub-tags', () => {
    const template = '<@defer><div>Heavy Content</div></@defer>';
    const result = parser.processDefer(template);

    assert.strictEqual(result.includes('data-ax-defer="true"'), true);
    assert.strictEqual(result.includes('data-ax-defer-when="idle"'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-content><div>Heavy Content</div></template>'), true);
  });

  await t.test('compiles <@defer when="visible"> with <@placeholder>', () => {
    const template = `
<@defer when="visible">
  <div class="heavy">Heavy Chart</div>
  <@placeholder>
    <div class="skeleton">Loading Chart...</div>
  </@placeholder>
</@defer>
`.trim();
    const result = parser.processDefer(template);

    assert.strictEqual(result.includes('data-ax-defer-when="visible"'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-placeholder>'), true);
    assert.strictEqual(result.includes('Loading Chart...'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-content>'), true);
    assert.strictEqual(result.includes('Heavy Chart'), true);
  });

  await t.test('compiles <@defer when="interaction"> with <@placeholder> and <@loading>', () => {
    const template = `
<@defer when="interaction">
  <div class="heavy">Interactive Widget</div>
  <@placeholder><span>Click to load</span></@placeholder>
  <@loading><span>Loading...</span></@loading>
</@defer>
`.trim();
    const result = parser.processDefer(template);

    assert.strictEqual(result.includes('data-ax-defer-when="interaction"'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-placeholder><span>Click to load</span></template>'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-loading><span>Loading...</span></template>'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-content><div class="heavy">Interactive Widget</div></template>'), true);
  });

  await t.test('compiles <@defer when="timer(1000)">', () => {
    const template = '<@defer when="timer(1000)"><p>Delayed text</p></@defer>';
    const result = parser.processDefer(template);

    assert.strictEqual(result.includes('data-ax-defer-when="timer(1000)"'), true);
    assert.strictEqual(result.includes('<template data-ax-defer-content><p>Delayed text</p></template>'), true);
  });

  await t.test('compiles <@defer when="state.show"> with expressions', () => {
    const template = '<@defer when="state.show"><p>{{ message }}</p></@defer>';
    const result = parser.processDefer(template);

    assert.strictEqual(result.includes('data-ax-defer-when="state.show"'), true);
    assert.strictEqual(result.includes('{% message %}'), true); // Escaped template expression
  });
});
