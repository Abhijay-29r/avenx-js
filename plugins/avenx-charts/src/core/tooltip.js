/**
 * Tooltip and Interactive Hit-Testing Module for Avenx Charts
 * @module plugins/avenx-charts/src/core/tooltip
 */

import { formatValue } from './theme.js';

/**
 * Finds the index of the closest data point to the given X pixel coordinate.
 * @param {number} mouseX - Current mouse/touch X coordinate inside SVG.
 * @param {Array<{ xCoord: number }>} points - Points with precomputed X coordinates.
 * @returns {number} Index of closest point or -1.
 */
export function findNearestIndex(mouseX, points) {
  if (!points || points.length === 0) return -1;
  if (points.length === 1) return 0;

  let closestIdx = 0;
  let minDiff = Math.abs(points[0].xCoord - mouseX);

  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i].xCoord - mouseX);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Renders HTML markup for an interactive tooltip card.
 * @param {object} info
 * @param {string|number} info.title - X-axis category or value.
 * @param {Array<{ name: string, value: any, color: string }>} info.items - Series values at this point.
 * @param {object} [theme] - Theme styling options.
 * @returns {string} HTML markup string for tooltip.
 */
export function renderTooltipContent(info, theme = {}) {
  const { title, items } = info;
  const textColor = theme.tooltipText || '#0f172a';
  const textMuted = theme.textMuted || '#64748b';
  const fontFamily = theme.fontFamily || 'sans-serif';

  const rowsHtml = items
    .map((item) => {
      const formatted = formatValue(item.value);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; flex-shrink: 0;"></span>
            <span style="font-size: 11px; color: ${textMuted}; font-weight: 500;">${item.name}:</span>
          </div>
          <span style="font-size: 12px; color: ${textColor}; font-weight: 600; font-variant-numeric: tabular-nums;">${formatted}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div style="font-family: ${fontFamily};">
      <div style="font-size: 11px; font-weight: 600; color: ${textColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding-bottom: 3px;">
        ${title}
      </div>
      ${rowsHtml}
    </div>
  `;
}

/**
 * Computes optimal pixel position for tooltip container relative to target point.
 * Ensures tooltip remains fully visible within chart boundary.
 * @param {number} targetX - Target point X coordinate.
 * @param {number} targetY - Target point Y coordinate.
 * @param {number} containerWidth - Chart container width.
 * @param {number} containerHeight - Chart container height.
 * @param {number} [tooltipWidth=150] - Estimated or measured tooltip width.
 * @param {number} [tooltipHeight=80] - Estimated or measured tooltip height.
 * @returns {{ left: number, top: number }} Position coordinates in pixels.
 */
export function calculateTooltipPosition(
  targetX,
  targetY,
  containerWidth,
  containerHeight,
  tooltipWidth = 150,
  tooltipHeight = 80
) {
  let left = targetX + 12;
  let top = targetY - tooltipHeight / 2;

  // Flip horizontally if exceeding right edge
  if (left + tooltipWidth > containerWidth - 10) {
    left = targetX - tooltipWidth - 12;
  }

  // Clamp left to not go off left edge
  left = Math.max(10, left);

  // Clamp top to stay within container
  if (top < 10) {
    top = 10;
  } else if (top + tooltipHeight > containerHeight - 10) {
    top = containerHeight - tooltipHeight - 10;
  }

  return { left, top };
}
