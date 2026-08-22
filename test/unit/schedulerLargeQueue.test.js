import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { queueJob, nextTick, resetScheduler, getSchedulerMaxFlushCount } from '../../lib/core/reactive/scheduler.js';

/**
 * Regression coverage for the flush guard that used to count every dequeued job
 * against `maxFlushCount` (the flush *recursion* ceiling, default 25). Past that
 * many jobs in a single tick the scheduler declared a circular update chain and
 * emptied the queue, silently discarding every remaining component's render.
 */

/**
 * A single tick may legitimately contain far more jobs than the recursion
 * ceiling; none of them may be discarded.
 */
async function testLargeJobQueueIsFullyDrained() {
  console.log('🧪 Testing large single-tick job queue is drained completely...');
  resetScheduler();

  const total = 200;
  const executed = [];

  for (let i = 0; i < total; i++) {
    const job = () => executed.push(i);
    job.id = i;
    queueJob(job);
  }

  await nextTick();

  assert.strictEqual(
    executed.length,
    total,
    `expected all ${total} queued jobs to run, but only ${executed.length} did`,
  );
  assert.ok(total > getSchedulerMaxFlushCount(), 'test must exceed the flush recursion ceiling to be meaningful');
  console.log(`  ✅ All ${total} jobs executed (ceiling is ${getSchedulerMaxFlushCount()}).`);
}

/**
 * The end-to-end symptom: components mutated in one tick must all re-render.
 */
async function testManyComponentsAllRender() {
  console.log('🧪 Testing 250 components updating in a single tick...');
  resetScheduler();

  const total = 250;
  const mounted = [];

  for (let i = 0; i < total; i++) {
    const component = new AvenxComponent({ n: 0 }, {}, {}, '<div>{{ n }}</div>', {}, {}, {}, {});
    const element = document.createElement('div');
    document.body.appendChild(element);
    component.__setMountTarget(element);
    component.update();
    mounted.push({ component, element });
  }

  // One shared cause, every component reacting within the same tick.
  mounted.forEach(({ component }) => {
    component.state.n = 1;
  });

  await nextTick();
  await nextTick();

  const stale = mounted.filter(({ element }) => !element.textContent.includes('1'));
  assert.strictEqual(stale.length, 0, `${stale.length} of ${total} components did not re-render`);
  console.log(`  ✅ All ${total} components re-rendered.`);
}

/**
 * The genuine runaway case must still be caught: the guard is narrowed, not removed.
 */
async function testSelfRequeueingJobIsStillAborted() {
  console.log('🧪 Testing runaway self-requeueing job is still aborted...');
  resetScheduler();

  let runs = 0;
  const job = () => {
    runs++;
    queueJob(job);
  };
  job.id = 'runaway';
  queueJob(job);

  await nextTick();

  assert.ok(runs > 0, 'job should have run at least once');
  assert.ok(runs <= 20, `runaway job should be bounded by the per-job limit, ran ${runs} times`);
  console.log(`  ✅ Runaway job aborted after ${runs} executions.`);
}

/**
 * Jobs are ordered by id so parents update before children — including jobs
 * queued while the drain is already in progress.
 */
async function testJobOrderingIsPreserved() {
  console.log('🧪 Testing job id ordering, including mid-flush enqueues...');
  resetScheduler();

  const order = [];
  const makeJob = (id) => {
    const job = () => order.push(id);
    job.id = id;
    return job;
  };

  queueJob(makeJob(30));
  queueJob(makeJob(10));

  // A job that queues a lower-id (parent) job while the drain is running.
  const spawner = () => {
    order.push(20);
    queueJob(makeJob(15));
  };
  spawner.id = 20;
  queueJob(spawner);

  await nextTick();

  // 15 is queued while 20 runs, so it joins the remaining drain ([30]) and is
  // ordered ahead of it — ascending id order holds across the whole flush.
  assert.deepStrictEqual(order, [10, 20, 15, 30], `unexpected execution order: ${order.join(', ')}`);
  console.log('  ✅ Ordering preserved across mid-flush enqueues.');
}

/**
 * nextTick must still resolve after a drain larger than the recursion ceiling.
 */
async function testNextTickResolvesAfterLargeDrain() {
  console.log('🧪 Testing nextTick resolves after a large drain...');
  resetScheduler();

  let jobsRun = 0;
  for (let i = 0; i < 100; i++) {
    const job = () => jobsRun++;
    job.id = i;
    queueJob(job);
  }

  let callbackRan = false;
  await nextTick(() => {
    callbackRan = true;
  });
  await nextTick();

  assert.strictEqual(jobsRun, 100, 'all jobs should have run');
  assert.ok(callbackRan, 'nextTick callback should have run after the drain');
  console.log('  ✅ nextTick callback ran after the full drain.');
}

(async () => {
  try {
    await testLargeJobQueueIsFullyDrained();
    await testManyComponentsAllRender();
    await testSelfRequeueingJobIsStillAborted();
    await testJobOrderingIsPreserved();
    await testNextTickResolvesAfterLargeDrain();
    console.log('🎉 All scheduler large-queue tests passed successfully!');
  } catch (err) {
    console.error('❌ Scheduler large-queue test failed:', err);
    process.exit(1);
  }
})();
