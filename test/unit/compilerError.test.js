import assert from 'assert';
import { AvenxError, AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';
import {
  CompilerError,
  TemplateValidationError,
  StyleCompilerError,
  BuildError,
  formatCodeFrame,
  getLineAndColumn,
} from '../../lib/compiler/errors/index.js';
import ExpressionParser from '../../lib/compiler/expressionParser.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

/**
 * Unit tests for specialized compiler error types.
 */
function runTests() {
  console.log('🧪 Testing specialized compiler error classes...');

  // 1. CompilerError base class inheritance
  const baseErr = new CompilerError(AvenxErrorCodes.COMPILER_SRC_DIR_MISSING, '/path/to/src');
  assert.ok(baseErr instanceof Error, 'CompilerError should inherit from Error');
  assert.ok(baseErr instanceof AvenxError, 'CompilerError should inherit from AvenxError');
  assert.strictEqual(baseErr.name, 'CompilerError');
  assert.strictEqual(baseErr.code, 'AVX_C02');
  assert.ok(baseErr.message.includes('[AVX_C02]'));

  // 2. TemplateValidationError inheritance and properties
  const tplErr = new TemplateValidationError(AvenxErrorCodes.COMPILER_EMPTY_TEMPLATE, 'CardComponent');
  assert.ok(tplErr instanceof Error, 'TemplateValidationError should inherit from Error');
  assert.ok(tplErr instanceof AvenxError, 'TemplateValidationError should inherit from AvenxError');
  assert.ok(tplErr instanceof CompilerError, 'TemplateValidationError should inherit from CompilerError');
  assert.strictEqual(tplErr.name, 'TemplateValidationError');
  assert.strictEqual(tplErr.code, 'AVX_W02');
  assert.ok(tplErr.message.includes('[AVX_W02]'));
  assert.ok(tplErr.message.includes('CardComponent'));

  // 3. StyleCompilerError inheritance and properties
  const styleErr = new StyleCompilerError(AvenxErrorCodes.COMPILER_PREPROCESSOR_MISSING, 'sass');
  assert.ok(styleErr instanceof Error, 'StyleCompilerError should inherit from Error');
  assert.ok(styleErr instanceof AvenxError, 'StyleCompilerError should inherit from AvenxError');
  assert.ok(styleErr instanceof CompilerError, 'StyleCompilerError should inherit from CompilerError');
  assert.strictEqual(styleErr.name, 'StyleCompilerError');
  assert.strictEqual(styleErr.code, 'AVX_W24');
  assert.ok(styleErr.message.includes('[AVX_W24]'));
  assert.ok(styleErr.message.includes('sass'));

  // 4. BuildError inheritance and properties
  const buildErr = new BuildError(AvenxErrorCodes.COMPILER_DUPLICATE_COMPONENT_NAME, 'Duplicate Details');
  assert.ok(buildErr instanceof Error, 'BuildError should inherit from Error');
  assert.ok(buildErr instanceof AvenxError, 'BuildError should inherit from AvenxError');
  assert.ok(buildErr instanceof CompilerError, 'BuildError should inherit from CompilerError');
  assert.strictEqual(buildErr.name, 'BuildError');
  assert.strictEqual(buildErr.code, 'AVX_C03');
  assert.ok(buildErr.message.includes('[AVX_C03]'));

  // 5. BuildError invalid config code (AVX_W25)
  const configErr = new BuildError(AvenxErrorCodes.COMPILER_INVALID_CONFIG, 'avenx.config.json', 'Unexpected token');
  assert.strictEqual(configErr.code, 'AVX_W25');
  assert.ok(configErr.message.includes('[AVX_W25]'));
  assert.ok(configErr.message.includes('avenx.config.json'));

  // 6. StyleCompilerError preprocessor compilation failure (AVX_W31)
  const preprocessErr = new StyleCompilerError(
    AvenxErrorCodes.COMPILER_PREPROCESSOR_FAILED,
    'sass',
    'Unexpected token',
  );

  assert.ok(preprocessErr instanceof Error, 'StyleCompilerError should inherit from Error');
  assert.ok(preprocessErr instanceof AvenxError, 'StyleCompilerError should inherit from AvenxError');
  assert.ok(preprocessErr instanceof CompilerError, 'StyleCompilerError should inherit from CompilerError');
  assert.strictEqual(preprocessErr.name, 'StyleCompilerError');
  assert.strictEqual(preprocessErr.code, 'AVX_W31');
  assert.ok(preprocessErr.message.includes('[AVX_W31]'));
  assert.ok(preprocessErr.message.includes('sass'));
  assert.ok(preprocessErr.message.includes('Unexpected token'));

  // 7. getLineAndColumn calculation
  const sampleSource = '<div class="card">\n  <state count="0" />\n  <p>{{ title }}</p>\n</div>';
  const posStart = getLineAndColumn(sampleSource, 0);
  assert.strictEqual(posStart.line, 1);
  assert.strictEqual(posStart.column, 1);

  const posLine2 = getLineAndColumn(sampleSource, sampleSource.indexOf('<state'));
  assert.strictEqual(posLine2.line, 2);
  assert.strictEqual(posLine2.column, 3);

  // 8. formatCodeFrame visual rendering with carets (^)
  const frame = formatCodeFrame(sampleSource, 2, 3);
  assert.ok(frame.includes(' 1 | <div class="card">'), 'Code frame should render preceding line');
  assert.ok(frame.includes(' 2 |   <state count="0" />'), 'Code frame should render target line');
  assert.ok(frame.includes('   |   ^'), 'Code frame should render caret pointer aligned to column');
  assert.ok(frame.includes(' 3 |   <p>{{ title }}</p>'), 'Code frame should render following line');

  // 9. formatCodeFrame custom length carets (^^^)
  const multiCaretFrame = formatCodeFrame(sampleSource, 2, 3, { length: 5 });
  assert.ok(multiCaretFrame.includes('   |   ^^^^^'), 'Code frame should render multi-character carets');

  // 10. CompilerError setLocation and constructor options
  const locErr = new TemplateValidationError(AvenxErrorCodes.COMPILER_UNDECLARED_REFERENCE, 'title', 'Card.js', {
    source: sampleSource,
    line: 3,
    column: 9,
  });

  assert.strictEqual(locErr.line, 3);
  assert.strictEqual(locErr.column, 9);
  assert.ok(locErr.frame.includes(' 3 |   <p>{{ title }}</p>'));
  assert.ok(locErr.frame.includes('   |         ^'));
  assert.ok(locErr.message.includes(locErr.frame), 'Error message should contain visual code frame');

  // 11. ExpressionParser code frame warning test
  const exprParser = new ExpressionParser({ warnings: { AVX_W28: 'error' } });
  const multiStateSource = '<state count="0" />\n<state count="1" />';
  assert.throws(
    () => {
      exprParser.parseState(multiStateSource);
    },
    (err) => {
      return (
        err instanceof CompilerError &&
        err.frame &&
        err.frame.includes(' 2 | <state count="1" />') &&
        err.frame.includes('   | ^')
      );
    },
    'ExpressionParser multiple state tags should include visual code frame with carets',
  );

  // 12. ComponentParser code frame warning test
  const compParser = new ComponentParser();
  compParser.config = { warnings: { AVX_W03: 'error' } };
  const rawTemplate = '<div>\n  <span>{{ undeclaredVar }}</span>\n</div>';
  assert.throws(
    () => {
      compParser.validateTemplate(rawTemplate, {}, {}, {}, {}, 'MyComp.component.js', 'MyComp');
    },
    (err) => {
      return (
        err instanceof CompilerError &&
        err.frame &&
        err.frame.includes(' 2 |   <span>{{ undeclaredVar }}</span>') &&
        err.frame.includes('   |         ^^^^^^^^^^^^^')
      );
    },
    'ComponentParser validateTemplate undeclared reference should include visual code frame with carets',
  );

  console.log('  ✅ Specialized compiler error classes unit tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('❌ Specialized compiler error classes unit tests failed!');
  console.error(error);
  process.exit(1);
}


