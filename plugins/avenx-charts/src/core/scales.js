/**
 * Scales and Coordinate Mapping Module for Avenx Charts
 * @module plugins/avenx-charts/src/core/scales
 */

/**
 * Calculates a "nice" rounded number approximately equal to x.
 * @param {number} x - The number to round.
 * @param {boolean} [round] - Whether to round or ceiling.
 * @returns {number}
 */
export function niceNum(x, round = false) {
  if (x === 0) return 0;
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nf;

  if (round) {
    if (f < 1.5) nf = 1;
    else if (f < 3) nf = 2;
    else if (f < 7) nf = 5;
    else nf = 10;
  } else {
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
  }

  return nf * Math.pow(10, exp);
}

/**
 * Generates an array of "nice" tick values between min and max.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @param {number} [tickCount] - Target number of ticks.
 * @returns {number[]} Array of tick values.
 */
export function generateLinearTicks(min, max, tickCount = 5) {
  if (min === max) {
    return [min];
  }

  const range = niceNum(max - min, false);
  const step = niceNum(range / (tickCount - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks = [];
  // Use precision rounding to avoid floating-point drift
  const precision = Math.max(0, -Math.floor(Math.log10(step)));

  for (let val = niceMin; val <= niceMax + step * 0.5; val += step) {
    ticks.push(Number(val.toFixed(precision)));
  }

  return ticks;
}

/**
 * Creates a continuous linear scale mapping values from a domain to a range.
 * @param {number[]} domain - [min, max] input domain.
 * @param {number[]} range - [start, end] output range (e.g. SVG pixel coordinates).
 * @param {object} [options]
 * @param {boolean} [options.clamp] - Whether to clamp output to the range.
 * @param {boolean} [options.nice] - Whether to extend domain to nice round numbers.
 * @param {number} [options.tickCount] - Number of ticks to target.
 * @returns {((val: number) => number) & { domain: number[], range: number[], ticks: (count?: number) => number[], invert: (val: number) => number }}
 */
export function createLinearScale(domain, range, options = {}) {
  let [d0, d1] = domain;
  const [r0, r1] = range;
  const { clamp = false, nice = true, tickCount = 5 } = options;

  if (d0 === d1) {
    d0 = d0 > 0 ? 0 : d0 - 1;
    d1 = d1 > 0 ? d1 + 1 : 1;
  }

  if (nice) {
    const ticks = generateLinearTicks(d0, d1, tickCount);
    d0 = Math.min(d0, ticks[0]);
    d1 = Math.max(d1, ticks[ticks.length - 1]);
  }

  const scale = function (val) {
    const num = Number(val) || 0;
    const t = (num - d0) / (d1 - d0);
    const result = r0 + t * (r1 - r0);
    if (!clamp) return result;
    const minR = Math.min(r0, r1);
    const maxR = Math.max(r0, r1);
    return Math.max(minR, Math.min(maxR, result));
  };

  scale.domain = [d0, d1];
  scale.range = [r0, r1];

  scale.invert = function (coord) {
    const t = (coord - r0) / (r1 - r0);
    return d0 + t * (d1 - d0);
  };

  scale.ticks = function (count = tickCount) {
    return generateLinearTicks(d0, d1, count);
  };

  return scale;
}

/**
 * Creates a categorical point scale mapping discrete categories evenly along a range.
 * Useful for line charts where points align directly with tick labels.
 * @param {string[]|number[]} domain - Array of category identifiers.
 * @param {number[]} range - [start, end] output pixel range.
 * @param {object} [options]
 * @param {number} [options.padding] - Relative outer padding (0 to 1).
 * @returns {((val: any) => number) & { domain: any[], range: number[], step: () => number, ticks: () => any[] }}
 */
export function createPointScale(domain, range, options = {}) {
  const [r0, r1] = range;
  const { padding = 0.5 } = options;
  const n = domain.length;

  const totalLength = r1 - r0;
  const denominator = Math.max(1, n - 1 + padding * 2);
  const step = totalLength / denominator;
  const start = r0 + step * padding;

  const mapping = new Map();
  domain.forEach((d, i) => {
    mapping.set(String(d), start + i * step);
  });

  const scale = function (val) {
    const key = String(val);
    if (mapping.has(key)) {
      return mapping.get(key);
    }
    return start;
  };

  scale.domain = [...domain];
  scale.range = [r0, r1];
  scale.step = () => step;
  scale.ticks = () => [...domain];

  return scale;
}

/**
 * Creates a categorical band scale mapping discrete categories to intervals along a range.
 * Useful for bar charts.
 * @param {string[]|number[]} domain - Array of category identifiers.
 * @param {number[]} range - [start, end] output pixel range.
 * @param {object} [options]
 * @param {number} [options.paddingInner] - Space between bands (0 to 1).
 * @param {number} [options.paddingOuter] - Space before first and after last band.
 * @returns {((val: any) => number) & { domain: any[], range: number[], bandwidth: () => number, step: () => number, ticks: () => any[] }}
 */
export function createBandScale(domain, range, options = {}) {
  const [r0, r1] = range;
  const { paddingInner = 0.2, paddingOuter = 0.1 } = options;
  const n = domain.length;

  const totalLength = r1 - r0;
  const stepCount = Math.max(1, n - paddingInner + paddingOuter * 2);
  const step = totalLength / stepCount;
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + step * paddingOuter;

  const mapping = new Map();
  domain.forEach((d, i) => {
    mapping.set(String(d), start + i * step);
  });

  const scale = function (val) {
    const key = String(val);
    if (mapping.has(key)) {
      return mapping.get(key);
    }
    return start;
  };

  scale.domain = [...domain];
  scale.range = [r0, r1];
  scale.bandwidth = () => bandwidth;
  scale.step = () => step;
  scale.ticks = () => [...domain];

  return scale;
}

/**
 * Extracts min and max numerical bounds from data for one or more property keys.
 * @param {object[]} data - Dataset array.
 * @param {string|string[]} keys - One or more property keys.
 * @param {object} [options]
 * @param {boolean} [options.includeZero] - Whether to include 0 in the domain.
 * @returns {[number, number]} [min, max]
 */
export function getExtent(data, keys, options = {}) {
  const { includeZero = true } = options;
  const keyList = Array.isArray(keys) ? keys : [keys];
  let min = Infinity;
  let max = -Infinity;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return [0, 100];
  }

  for (const item of data) {
    if (!item) continue;
    for (const key of keyList) {
      const val = Number(item[key]);
      if (!isNaN(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
  }

  if (min === Infinity || max === -Infinity) {
    return [0, 100];
  }

  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }

  return [min, max];
}
