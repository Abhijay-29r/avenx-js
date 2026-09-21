/**
 * @file dynamicAttributeEventGuard.test.js
 * @description A dynamic attribute name must not be able to install an inline
 * event handler.
 *
 * A literal `onclick="{{ handler }}"` is refused at build time (AVX_C28), but
 * `:[name]="value"` is only known at run time, so the refusal has to happen in
 * the renderer. The compiled renderer (`program/bindings.js`) and the DOM
 * patcher (`domPatch.js`) both did that already. `renderTemplate.js` did not --
 * and that is the renderer this construct actually reaches, because a dynamic
 * attribute name is itself a reason a template cannot be compiled (AVX_W47).
 *
 * Because the name was written straight into the markup, the handler was a
 * parsed inline handler by the time the patcher saw the element, rather than a
 * dynamic attribute it would police. Measured in a browser on a production
 * build served without a Content-Security-Policy: `:[handlerName]="handlerBody"`
 * with handlerName = 'onclick' produced `onclick="window.__xss=1"` and ran it
 * on the next click. A strict CSP stopped the execution but not the attribute.
 */
import assert from 'assert';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

/**
 * Renders a template, resolving expressions from a scope object.
 * @param {string} template - The template source.
 * @param {object} scope - Values the expressions resolve to.
 * @returns {{html: string, warnings: string[]}} The rendered markup and warnings.
 */
function render(template, scope) {
  const warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (...args) => warnings.push(args.join(' '));
  try {
    const html = new TemplateRenderer().render(template, (expr) => scope[expr.trim()]);
    return { html, warnings };
  } finally {
    logger.warn = originalWarn;
  }
}

try {
  console.log('🧪 Testing the dynamic attribute event-handler guard...');

  // 1. Every on* spelling is refused, and reported as AVX_R35.
  for (const handler of ['onclick', 'onerror', 'ONCLICK', 'onMouseOver', 'onload']) {
    const { html, warnings } = render('<span :[n]="v">x</span>', {
      n: handler,
      v: 'window.__xss = 1',
    });

    assert.ok(
      !/\son[a-z]+\s*=/i.test(html),
      `a dynamic name resolving to "${handler}" must not write a handler, got: ${html}`,
    );
    assert.ok(!html.includes('window.__xss'), `nor its value, got: ${html}`);
    assert.ok(
      warnings.some((w) => w.includes('AVX_R35')),
      `refusing "${handler}" must be reported as AVX_R35, got: ${JSON.stringify(warnings)}`,
    );
  }

  // 2. The refused name is not tracked as an applied dynamic attribute either,
  //    which would leave the patcher believing it owns an attribute that was
  //    never set.
  {
    const { html } = render('<span :[n]="v">x</span>', { n: 'onclick', v: 'boom()' });
    assert.ok(!html.includes('data-ax-dyn-attrs'), `nothing to track, got: ${html}`);
  }
  console.log('  ✅ an on* name is refused, reported, and not tracked');

  // 3. Ordinary dynamic attributes are unaffected -- the guard must not be
  //    bought at the cost of the feature.
  {
    const { html, warnings } = render('<span :[n]="v">x</span>', { n: 'data-tone', v: 'warm' });
    assert.ok(html.includes('data-tone="warm"'), `a safe dynamic attribute still applies, got: ${html}`);
    assert.ok(html.includes('data-ax-dyn-attrs="data-tone"'), 'and is still tracked');
    assert.deepStrictEqual(warnings, [], 'and reports nothing');
  }

  // 4. A name that merely starts with "on" is a normal attribute.
  {
    const { html } = render('<span :[n]="v">x</span>', { n: 'one', v: '1' });
    assert.ok(html.includes('one="1"'), `"one" is not an event handler, got: ${html}`);
  }

  // 5. A refused handler beside a legitimate dynamic attribute on the same tag
  //    drops only the handler.
  {
    const { html } = render('<span :[a]="av" :[b]="bv">x</span>', {
      a: 'onclick',
      av: 'boom()',
      b: 'data-tone',
      bv: 'warm',
    });
    assert.ok(!/\sonclick\s*=/i.test(html), `the handler is dropped, got: ${html}`);
    assert.ok(html.includes('data-tone="warm"'), `the safe one survives, got: ${html}`);
  }
  console.log('  ✅ legitimate dynamic attributes still work');

  console.log('Dynamic attribute event guard tests passed!');
} catch (error) {
  console.error('Dynamic attribute event guard tests failed!');
  console.error(error);
  process.exit(1);
}
