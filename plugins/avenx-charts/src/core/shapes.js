/**
 * SVG Path and Shape Generation for Avenx Charts
 * @module plugins/avenx-charts/src/core/shapes
 */

/**
 * @typedef {[number, number]} Point - [x, y] coordinates
 */

/**
 * Generates an SVG path string for a linear line connecting points.
 * @param {Point[]} points - Array of [x, y] coordinate pairs.
 * @returns {string} SVG path d attribute string.
 */
export function generateLinearPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0][0]},${points[0][1]}`;
  }

  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]},${points[i][1]}`;
  }
  return d;
}

/**
 * Calculates control points for a smooth Catmull-Rom spline segment.
 * @param {Point} p0 - Previous point.
 * @param {Point} p1 - Current start point.
 * @param {Point} p2 - Next end point.
 * @param {Point} p3 - Point after next.
 * @param {number} [tension] - Curve tension (0 = linear, 0.5 = loose, 0.33 = natural).
 * @returns {[Point, Point]} [controlPoint1, controlPoint2]
 */
function getCatmullRomControlPoints(p0, p1, p2, p3, tension = 0.33) {
  const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
  const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
  const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
  const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
  return [
    [cp1x, cp1y],
    [cp2x, cp2y],
  ];
}

/**
 * Generates a smooth cubic Bezier SVG path through the given points.
 * Uses Catmull-Rom interpolation for aesthetic, natural curve smoothing.
 * @param {Point[]} points - Array of [x, y] coordinate pairs.
 * @param {number} [tension] - Curve tension parameter.
 * @returns {string} SVG path d attribute string.
 */
export function generateSmoothPath(points, tension = 0.33) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0][0]},${points[0][1]}`;
  }
  if (points.length === 2) {
    return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
  }

  let d = `M ${points[0][0]},${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const [cp1, cp2] = getCatmullRomControlPoints(p0, p1, p2, p3, tension);
    d += ` C ${cp1[0].toFixed(2)},${cp1[1].toFixed(2)} ${cp2[0].toFixed(2)},${cp2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return d;
}

/**
 * Generates a stepped SVG path between points.
 * @param {Point[]} points - Array of [x, y] coordinate pairs.
 * @param {'after'|'before'|'middle'} [stepPosition] - Position where step occurs.
 * @returns {string} SVG path d attribute string.
 */
export function generateStepPath(points, stepPosition = 'after') {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0][0]},${points[0][1]}`;
  }

  let d = `M ${points[0][0]},${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];

    if (stepPosition === 'before') {
      d += ` L ${curr[0]},${next[1]} L ${next[0]},${next[1]}`;
    } else if (stepPosition === 'middle') {
      const midX = (curr[0] + next[0]) / 2;
      d += ` L ${midX},${curr[1]} L ${midX},${next[1]} L ${next[0]},${next[1]}`;
    } else {
      // 'after'
      d += ` L ${next[0]},${curr[1]} L ${next[0]},${next[1]}`;
    }
  }

  return d;
}

/**
 * Generates a closed area SVG path for gradient fills under the line.
 * @param {Point[]} points - Array of [x, y] points.
 * @param {number} baselineY - Y coordinate of the baseline (e.g. bottom axis or 0 line).
 * @param {'smooth'|'linear'|'step'} [curve] - Curve style.
 * @returns {string} SVG path string closed to baseline.
 */
export function generateAreaPath(points, baselineY, curve = 'smooth') {
  if (!points || points.length === 0) return '';

  let lineD;
  if (curve === 'smooth' && points.length > 2) {
    lineD = generateSmoothPath(points);
  } else if (curve === 'step') {
    lineD = generateStepPath(points);
  } else {
    lineD = generateLinearPath(points);
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  return `${lineD} L ${lastPoint[0]},${baselineY} L ${firstPoint[0]},${baselineY} Z`;
}

/**
 * Generates SVG path segments for horizontal and vertical grid lines.
 * @param {number[]} xCoords - Array of X pixel coordinates for vertical lines.
 * @param {number[]} yCoords - Array of Y pixel coordinates for horizontal lines.
 * @param {[number, number]} xRange - [xMin, xMax] plot bounds.
 * @param {[number, number]} yRange - [yMin, yMax] plot bounds.
 * @param {object} [options]
 * @param {boolean} [options.horizontal] - Render horizontal grid lines.
 * @param {boolean} [options.vertical] - Render vertical grid lines.
 * @returns {string} SVG path d string of all grid lines combined.
 */
export function generateGridLines(xCoords, yCoords, xRange, yRange, options = {}) {
  const { horizontal = true, vertical = false } = options;
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  let d = '';

  if (horizontal && yCoords) {
    for (const y of yCoords) {
      d += ` M ${xMin},${y.toFixed(2)} L ${xMax},${y.toFixed(2)}`;
    }
  }

  if (vertical && xCoords) {
    for (const x of xCoords) {
      d += ` M ${x.toFixed(2)},${yMin} L ${x.toFixed(2)},${yMax}`;
    }
  }

  return d.trim();
}
