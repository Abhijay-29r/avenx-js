import assert from 'assert';
import { EventExecutor } from '../../lib/core/events/eventExecutor.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

try {
  console.log('🧪 Testing EventExecutor...');

  const createMockEvent = (tagName, eventType, componentName) => {
    return {
      type: eventType,
      target: {
        tagName,
        __avenx_comp_instance: {
          $logContext: { componentName }
        }
      }
    };
  };

  // 1. Existing successful event execution still works
  {
    let executeCount = 0;
    const runHandler = (fn, event) => {
      executeCount++;
      return fn({ count: 0 }, {}, event, []);
    };
    const executor = new EventExecutor(runHandler);
    const mockEvent = createMockEvent('BUTTON', 'click', 'TestComp');
    
    executor.execute('state.count++', mockEvent);
    
    assert.strictEqual(executeCount, 1, 'runHandler should execute successfully');
  }

  // 2. Runtime Error Execution path
  {
    const originalLoggerError = logger.error;
    const loggedMessages = [];
    logger.error = (msg, ctx) => {
      loggedMessages.push({ msg, ctx });
    };

    let caughtError = null;
    const runHandler = (fn, event) => {
      // Simulate AvenxComponent's catch block logic
      try {
        fn({ state: {} }, {}, event, []);
      } catch (err) {
        caughtError = err;
        // Simulate AvenxComponent logging the stringified error
        logger.error(`[AVX_R09] Event handler execution failed for statement "throw new Error('boom')". Error: ${err}`, { componentName: 'TestComp' });
      }
    };
    
    const executor = new EventExecutor(runHandler);
    const mockEvent = createMockEvent('DIV', 'mouseover', 'TestComp');
    
    try {
      executor.execute("throw new Error('boom')", mockEvent);
      
      assert.ok(caughtError, 'Error should be thrown and caught by runHandler simulator');
      assert.strictEqual(caughtError.cause.message, 'boom', 'Original error should be preserved as cause');
      
      const log = loggedMessages[0];
      assert.ok(log, 'Logger should be called');
      assert.strictEqual(log.ctx.componentName, 'TestComp', 'Component name should be present in context');
      assert.ok(log.msg.includes('<DIV>'), 'Element tag should be present in stringified error message');
      assert.ok(log.msg.includes("'mouseover'"), 'Event type should be present in stringified error message');
      assert.ok(log.msg.includes("throw new Error('boom')"), 'Action string should be present');
      assert.ok(log.msg.includes('[AVX_R09]'), 'Should have AVX_R09');
    } finally {
      logger.error = originalLoggerError;
    }
  }

  // 3. Compilation Error path (Syntax Error)
  {
    const originalLoggerError = logger.error;
    const loggedMessages = [];
    logger.error = (msg, ctx) => {
      loggedMessages.push({ msg, ctx });
    };

    const runHandler = () => {};
    const executor = new EventExecutor(runHandler);
    const mockEvent = createMockEvent('SPAN', 'click', 'ErrorComp');
    
    try {
      let errorThrown = null;
      try {
        executor.execute('class { foo() {', mockEvent);
      } catch (e) {
        errorThrown = e;
      }
      
      assert.ok(errorThrown instanceof SyntaxError, 'Execute should throw on compilation error');
      
      const log = loggedMessages[0];
      assert.ok(log, 'Logger should be called for compilation error');
      assert.strictEqual(log.ctx.componentName, 'ErrorComp', 'Component name should be present in context');
      assert.ok(log.msg.includes('<SPAN>'), 'Element tag should be present in log message');
      assert.ok(log.msg.includes("'click'"), 'Event type should be present in log message');
      assert.ok(log.msg.includes('class { foo() {'), 'Action string should be present in log message');
      assert.ok(log.msg.includes('[AVX_R09]'), 'Should have AVX_R09');
    } finally {
      logger.error = originalLoggerError;
    }
  }

  // 4. Missing Handler (Torn down state)
  {
    const executor = new EventExecutor(null);
    let errorThrown = false;
    try {
      executor.execute('state.x = 1');
    } catch (err) {
      errorThrown = true;
      assert.ok(err instanceof TypeError, 'Should throw TypeError if handler torn down');
    }
    assert.ok(errorThrown, 'Should preserve existing error behavior for unconfigured handler');
  }

  console.log('✅ EventExecutor tests passed.');
} catch (e) {
  console.error(`❌ EventExecutor test failed: ${e.message}`);
  process.exit(1);
}
