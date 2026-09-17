# ADR 0008 — A reactive cycle quarantines its job, not the queue

- Status: accepted
- Branch: `fix/scheduler-dropped-jobs`
- Addresses: "Scheduler drops work" in `../initial-assessment.md` §5

## Context

`handleDeadlock` ended with:

```js
queue.length = 0;
queued.clear();
```

One job exceeding the per-flush frequency limit therefore discarded **every**
pending job in that tick. The cycle was reported; the unrelated components whose
updates were thrown away were not. Their DOM kept showing stale state, and
nothing in the log connected the two. The same applied to the flush-depth
ceiling.

This is a silent-data-loss class of bug: the framework decided not to apply
updates it had accepted, and said nothing about them.

## Decision

Quarantine the offending jobs for the remainder of the current top-level flush,
and let everything else drain.

- A job that trips the per-job frequency limit is added to `suppressedJobs`,
  removed from the queue if present, and the drain **continues** instead of
  breaking out of the loop.
- A job already quarantined is skipped when it re-queues itself.
- The flush-depth ceiling quarantines the jobs recorded in `executionHistory` —
  the ones that actually took part in the recursion — rather than the queue.
- `suppressedJobs` is cleared when the top-level flush ends (and by
  `resetScheduler`), so a later user action re-queues the component normally and
  the application recovers.

The diagnostic (`AVX_R18`), the cycle path and the `onSchedulerDeadlock`
handlers are unchanged: a cycle is still reported exactly as before.

## Compatibility

- No public API change.
- Behaviour change: after a cycle is detected, unrelated components now receive
  their pending update instead of silently losing it. Nothing that previously
  ran stops running.

## Evidence

`test/unit/schedulerJobLoss.test.js`:

- a job that re-queues itself forever is stopped (bounded run count), while an
  unrelated job queued beside it and one queued after it each still run exactly
  once, and `AVX_R18` still names the offending job;
- work queued alongside a cycle still runs;
- an ordinary flush of 50 jobs is unaffected.

Fails on the base branch with "an unrelated queued job still ran exactly once".
