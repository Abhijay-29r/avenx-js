import assert from 'assert';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import AvenxCompiler from '../../lib/compiler.js';

try {
  console.log('🧪 Testing Custom Preprocessor Hooks for Template Parsing...');

  // Mock Pug-to-HTML translator function
  const mockPugCompiler = (pugCode) => {
    // Simple mock converter translating simple Pug-like lines into HTML
    let html = pugCode
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.startsWith('div.container')) {
          return '<div class="container">';
        }
        if (line.startsWith('h1')) {
          const text = line.replace(/^h1\s*/, '');
          return `<h1>${text}</h1>`;
        }
        if (line.startsWith('p')) {
          const text = line.replace(/^p\s*/, '');
          return `<p>${text}</p>`;
        }
        if (line.startsWith('button')) {
          const attrAndText = line.replace(/^button\s*/, '');
          if (attrAndText.includes('(@click=')) {
            const action = attrAndText.match(/@click=["']?([^"']+)["']?/)?.[1] || '';
            const label = attrAndText.split(' ').slice(1).join(' ');
            return `<button @click="${action}">${label}</button>`;
          }
          return `<button>${attrAndText}</button>`;
        }
        if (line === 'enddiv') {
          return '</div>';
        }
        return line;
      })
      .join('\n');

    if (html.includes('<div class="container">') && !html.includes('</div>')) {
      html += '\n</div>';
    }
    return html;
  };

  // Test 1: ComponentParser with preprocessors config object mapping { pug: mockPugCompiler }
  console.log('  Testing ComponentParser with preprocessors mapping option ({ pug: filterFn })...');
  const sp1 = new StyleProcessor();
  const cp1 = new ComponentParser(sp1, [], {
    preprocessors: {
      pug: mockPugCompiler,
    },
  });

  const pugComponentContent = `
    <state count="0" />
    <action name="inc">count++</action>
    <template lang="pug">
      div.container
        h1 Counter Header
        button (@click="inc") Increment
    </template>
  `;

  const state1 = cp1.extractState(pugComponentContent);
  assert.strictEqual(state1.count, 0, 'State should be extracted correctly');

  const methods1 = cp1.extractMethods(pugComponentContent);
  assert.strictEqual(methods1.inc, 'count++', 'Action should be extracted correctly');

  const template1 = cp1.extractTemplate(pugComponentContent, {}, 'TestPugComp');
  assert.ok(template1.includes('<div class="container">'), 'Pug code should be translated to div.container');
  assert.ok(template1.includes('<h1>Counter Header</h1>'), 'Pug code should be translated to h1 header');
  assert.ok(template1.includes('data-ax-event'), 'Click directive should be compiled into data-ax-event delegation');

  // Test 2: Preprocessor hook provided as a single function in config
  console.log('  Testing preprocessors option as a single filter function...');
  const sp2 = new StyleProcessor();
  const cp2 = new ComponentParser(sp2, [], {
    preprocessors: (code) => code.replace(/#HEADER#/g, '<h1>Dynamic Header</h1>'),
  });

  const customTemplate = `
    <state count="1" />
    <div>
      #HEADER#
      <p>Content</p>
    </div>
  `;

  const template2 = cp2.extractTemplate(customTemplate, {}, 'TestCustomComp');
  assert.ok(template2.includes('<h1>Dynamic Header</h1>'), 'Filter function should replace template tokens');

  // Test 3: Acceptance Criteria Verification with AvenxCompiler options
  console.log('  Testing AvenxCompiler integration with custom preprocessor hook...');
  const compiler = new AvenxCompiler({
    preprocessors: {
      pug: mockPugCompiler,
    },
  });

  const parsedResult = compiler.componentParser.preprocessTemplate(
    `<template lang="pug">
      div.container
        h1 Pug Translated
    </template>`
  );

  assert.ok(parsedResult.includes('<div class="container">'), 'Compiler componentParser should process Pug template into HTML');
  assert.ok(parsedResult.includes('<h1>Pug Translated</h1>'), 'Compiler componentParser should translate Pug header into HTML header');

  console.log('  ✅ Custom Preprocessor Hooks for Template Parsing tests passed!');
} catch (error) {
  console.error('❌ Custom Preprocessor Hooks tests failed!');
  console.error(error);
  process.exit(1);
}
