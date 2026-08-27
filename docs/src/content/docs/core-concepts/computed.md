---
title: 'Computed Properties'
description: 'Learn how to use computed properties with automatic caching and dependency tracking in Avenx-JS.'
---

Computed properties are reactive, memoized derivations of component state and other reactive values. They are useful when a value can be calculated from existing data and should automatically update when its dependencies change.

Unlike ordinary methods, computed properties cache their result and only re-evaluate when a dependency that was used during the previous evaluation changes.

## Mental Model

A computed property should be treated as a **pure derivation**:

```text
Reactive State
     │
     ▼
Dependency Tracking
     │
     ▼
Computed Expression
     │
     ▼
Cached Result
     │
     └──── dependency changes ────► Re-evaluate
