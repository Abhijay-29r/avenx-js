/**
 * Official Declarative & Reactive Charting Plugin for Avenx.js
 * @module @avenx/charts
 */

export { avenxCharts, createAvenxCharts, CHART_TYPES, default } from './plugin.js';
export { BaseChart, ChartLine } from './components/index.js';
export { chartsPreprocessor, parseChartAttributes } from './preprocessor.js';
export {
  createLinearScale,
  createPointScale,
  createBandScale,
  generateLinearTicks,
  getExtent,
  niceNum,
} from './core/scales.js';
export {
  generateLinearPath,
  generateSmoothPath,
  generateStepPath,
  generateAreaPath,
  generateGridLines,
} from './core/shapes.js';
export {
  PALETTES,
  THEMES,
  getColor,
  resolveTheme,
  formatValue,
} from './core/theme.js';
export { normalizeSeries, renderLegendHtml } from './core/legend.js';
export {
  findNearestIndex,
  renderTooltipContent,
  calculateTooltipPosition,
} from './core/tooltip.js';
