/**
 * @file schedulerJobLoss.test.js
 * @description A runaway job must not take unrelated pending work with it.
 *
 * When one job exceeded the per-flush frequency limit, `handleDeadlock` cleared
 * the whole queue: `queue.length = 0`. Every other component with an update
 * pending in that tick silently never ran, so unrelated parts of the page were
 * left showing stale state with nothing logged about them.
 *
 * The cycle still has to be stopped. Only the offending job is quarantined for
 * the rest of the flush; everything else drains normally.
 */
import assert from 'node:assert';
import { queueJob, resetScheduler, nextTick, onSchedulerDeadlock } from '../../lib/core/reactive/scheduler.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

/**
 * Runs a flush and returns what the scheduler reported.
 * @param {Function} body - Sets up the jobs.
 * @returns {Promise<{errors: string[], deadlocks: object[]}>} Reports.
 */
async function withScheduler(body) {
  resetScheduler();
  const errors = [];
  const deadlocks = [];
  const originalError = logger.error;
  logger.error = (message) => errors.push(String(message));
  const stop = onSchedulerDeadlock((payload) => deadlocks.push(payload));
  try {
    body();
    await nextTick();
    await nextTick();
    await nextTick();
  } finally {
    logger.error = originalError;
    stop();
    resetScheduler();
  }
  return { errors, deadlocks };
}

try {
  console.log('🧪 A looping job does not cancel unrelated pending jobs');

  let loops = 0;
  let unrelatedRuns = 0;
  let laterRuns = 0;

  const looping = () => {
    loops += 1;
    // Re-queues itself forever: the signature of a reactive cycle.
    queueJob(looping);
  };
  looping.id = 1;
  Object.defineProperty(looping, 'name', { value: 'looping', configurable: true });

  const unrelated = () => {
    unrelatedRuns += 1;
  };
  unrelated.id = 2;
  Object.defineProperty(unrelated, 'name', { value: 'unrelated', configurable: true });

  const later = () => {
    laterRuns += 1;
  };
  later.id = 3;
  Object.defineProperty(later, 'name', { value: 'later', configurable: true });

  const report = await withScheduler(() => {
    queueJob(looping);
    queueJob(unrelated);
    queueJob(later);
  });

  assert.ok(loops > 1, 'the looping job ran');
  assert.ok(loops <= 12, `the loop was stopped, ran ${loops} times`);
  assert.strictEqual(unrelatedRuns, 1, 'an unrelated queued job still ran exactly once');
  assert.strictEqual(laterRuns, 1, 'a job queued after the looping one still ran');
  assert.ok(
    report.errors.some((message) => message.includes('AVX_R18')),
    `the cycle is still reported:\n${report.errors.join('\n')}`,
  );
  assert.ok(
    report.errors.some((message) => message.includes('looping')),
    'the report names the offending job',
  );
  assert.strictEqual(report.deadlocks.length >= 1, true, 'deadlock handlers are still notified');

  console.log('🧪 Work queued after a cycle is stopped still runs');

  let recovered = 0;
  await withScheduler(() => {
    const spinner = () => {
      queueJob(spinner);
    };
    spinner.id = 1;
    Object.defineProperty(spinner, 'name', { value: 'spinner', configurable: true });
    queueJob(spinner);

    const recovery = () => {
      recovered += 1;
    };
    recovery.id = 2;
    Object.defineProperty(recovery, 'name', { value: 'recovery', configurable: true });
    queueJob(recovery);
  });
  assert.strictEqual(recovered, 1, 'the recovery job ran');

  console.log('🧪 An ordinary flush with many jobs is unaffected');

  let ran = 0;
  await withScheduler(() => {
    for (let i = 0; i < 50; i++) {
      const job = () => {
        ran += 1;
      };
      job.id = i;
      Object.defineProperty(job, 'name', { value: `job-${i}`, configurable: true });
      queueJob(job);
    }
  });
  assert.strictEqual(ran, 50, 'every queued job ran');

  console.log('  ✅ Scheduler job-loss tests passed!');
} catch (error) {
  console.error('❌ Scheduler job-loss tests failed:', error);
  process.exitCode = 1;
}
