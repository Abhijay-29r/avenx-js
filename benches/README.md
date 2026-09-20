# Avenx-JS Benchmarks

This directory contains performance benchmarks for various parts of the Avenx-JS framework.

## Running Benchmarks

To run all benchmarks, use the following command from the project root:

```bash
node benches/run.js
```

## Available Benchmarks

- **component-parser.bench.js**: Measures the speed of parsing `.component.js` and `.component.css` files into JavaScript classes.
- **style-processor.bench.js**: Measures the speed of processing HTML templates, scoping CSS rules, and applying variables.
- **runtime-render.bench.js**: Measures the speed of the runtime template interpolation (rendering).
- **incremental-rebuild.bench.js**: Measures what the compilation cache saves a watch rebuild, comparing a rebuild after a one-line edit against a cold build of the same project at two sizes.

## Methodology

Each benchmark runs a set number of iterations (e.g., 1000 or 5000) after a warmup phase. It reports the total time, average time per operation, and operations per second (Ops/sec).
