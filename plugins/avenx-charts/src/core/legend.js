/**
 * Legend Generator and Interaction Module for Avenx Charts
 * @module plugins/avenx-charts/src/core/legend
 */

/**
 * @typedef {object} SeriesConfig
 * @property {string} key - Property key in dataset.
 * @property {string} [name] - Human-readable label.
 * @property {string} [color] - Hex or CSS color.
 * @property {boolean} [hidden=false] - Whether the series is hidden by user toggle.
 */

/**
 * Normalizes user-provided series configuration.
 * @param {string|string[]|SeriesConfig[]} rawSeries - Series specification.
 * @param {string[]|string} palette - Color palette.
 * @returns {SeriesConfig[]} Normalized series configs.
 */
export function normalizeSeries(rawSeries, palette = 'default') {
  if (!rawSeries) return [];

  let list = [];
  if (typeof rawSeries === 'string') {
    list = [rawSeries];
  } else if (Array.isArray(rawSeries)) {
    list = rawSeries;
  }

  const { getColor } = awaitImportThemeSync();

  return list.map((item, index) => {
    if (typeof item === 'string') {
      return {
        key: item,
        name: item.charAt(0).toUpperCase() + item.slice(1).replace(/([A-Z])/g, ' $1'),
        color: getColor(palette, index),
        hidden: false,
      };
    }
    return {
      key: item.key || item.y || `series_${index}`,
      name: item.name || item.label || item.key || `Series ${index + 1}`,
      color: item.color || getColor(palette, index),
      hidden: !!item.hidden,
    };
  });
}

// Internal sync helper to access getColor
let _getColor = null;
function awaitImportThemeSync() {
  if (!_getColor) {
    // Fallback simple palette in case of cycle
    _getColor = (palette, index) => {
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
      return colors[index % colors.length];
    };
  }
  return { getColor: _getColor };
}

/**
 * Renders HTML markup for a chart legend.
 * @param {SeriesConfig[]} seriesList - Array of series configurations.
 * @param {object} [theme] - Active theme configuration.
 * @returns {string} HTML string for the legend container.
 */
export function renderLegendHtml(seriesList, theme = {}) {
  if (!seriesList || seriesList.length === 0) return '';

  const textColor = theme.textColor || '#475569';
  const textMuted = theme.textMuted || '#94a3b8';
  const fontFamily = theme.fontFamily || 'sans-serif';

  const itemsHtml = seriesList
    .map((s, idx) => {
      const opacity = s.hidden ? '0.4' : '1';
      const textCol = s.hidden ? textMuted : textColor;
      return `
        <div class="ax-chart-legend-item" data-series-idx="${idx}" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; font-family: ${fontFamily}; font-size: 12px; color: ${textCol}; opacity: ${opacity}; transition: opacity 0.2s ease;">
          <span class="ax-chart-legend-dot" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${s.color};"></span>
          <span class="ax-chart-legend-label">${s.name}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="ax-chart-legend" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; padding: 8px 12px; margin-bottom: 4px;">
      ${itemsHtml}
    </div>
  `;
}
