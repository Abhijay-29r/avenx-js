/**
 * Themes and Color Palettes for Avenx Charts
 * @module plugins/avenx-charts/src/core/theme
 */

export const PALETTES = {
  default: [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#3b82f6', // Blue
  ],
  modern: [
    '#3b82f6', // Bright Blue
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#a855f7', // Purple
    '#e11d48', // Crimson
    '#84cc16', // Lime
  ],
  neon: [
    '#00f5d4', // Neon Cyan
    '#7b2cbf', // Neon Purple
    '#fee440', // Neon Yellow
    '#f72585', // Neon Magenta
    '#4cc9f0', // Neon Blue
  ],
  monochrome: [
    '#1e293b',
    '#475569',
    '#64748b',
    '#94a3b8',
    '#cbd5e1',
  ],
};

export const THEMES = {
  light: {
    background: 'transparent',
    textColor: '#475569',
    textMuted: '#94a3b8',
    gridColor: 'rgba(226, 232, 240, 0.8)',
    axisColor: 'rgba(203, 213, 225, 0.8)',
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipText: '#0f172a',
    tooltipBorder: 'rgba(226, 232, 240, 0.9)',
    tooltipShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    crosshairColor: 'rgba(100, 116, 139, 0.35)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '11px',
  },
  dark: {
    background: 'transparent',
    textColor: '#cbd5e1',
    textMuted: '#64748b',
    gridColor: 'rgba(51, 65, 85, 0.4)',
    axisColor: 'rgba(71, 85, 105, 0.6)',
    tooltipBg: 'rgba(15, 23, 42, 0.94)',
    tooltipText: '#f8fafc',
    tooltipBorder: 'rgba(51, 65, 85, 0.8)',
    tooltipShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    crosshairColor: 'rgba(148, 163, 184, 0.35)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '11px',
  },
};

/**
 * Resolves a color for a given series index from a palette.
 * @param {string[]|string} palette - Array of color hex strings or named palette.
 * @param {number} index - Series index.
 * @returns {string} Hex color string.
 */
export function getColor(palette, index = 0) {
  const colors = Array.isArray(palette)
    ? palette
    : (PALETTES[palette] || PALETTES.default);
  return colors[index % colors.length];
}

/**
 * Resolves theme configuration object from name or custom overrides.
 * @param {string|object} [theme] - Theme name ('light'|'dark') or custom style object.
 * @returns {typeof THEMES.light} Merged theme configuration.
 */
export function resolveTheme(theme = 'light') {
  if (typeof theme === 'object' && theme !== null) {
    const base = theme.mode === 'dark' ? THEMES.dark : THEMES.light;
    return { ...base, ...theme };
  }
  return THEMES[theme] || THEMES.light;
}

/**
 * Formats a numerical value nicely for axis labels and tooltips.
 * @param {number} value
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {string} [options.suffix]
 * @param {number} [options.precision]
 * @returns {string} Formatted number string.
 */
export function formatValue(value, options = {}) {
  const { prefix = '', suffix = '', precision } = options;
  if (value === null || value === undefined || isNaN(value)) {
    return '–';
  }

  const num = Number(value);

  let formatted;
  if (precision !== undefined) {
    formatted = num.toFixed(precision);
  } else if (Math.abs(num) >= 1_000_000) {
    formatted = `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  } else if (Math.abs(num) >= 1_000) {
    formatted = `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  } else {
    formatted = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
  }

  return `${prefix}${formatted}${suffix}`;
}
