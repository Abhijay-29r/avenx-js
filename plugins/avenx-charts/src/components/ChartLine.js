/**
 * Line Chart Component for Avenx Charts
 * @module plugins/avenx-charts/src/components/ChartLine
 */

import { BaseChart } from './BaseChart.js';
import {
  generateLinearPath,
  generateSmoothPath,
  generateStepPath,
  generateAreaPath,
} from '../core/shapes.js';

/**
 * Declarative Line Chart Component (<chart.line />).
 * Extends BaseChart with SVG line paths, area gradients, curve smoothing, and data dots.
 */
export class ChartLine extends BaseChart {
  /**
   * @param {object} [bridges] - External bridges.
   * @param {object} [props] - Component properties.
   */
  constructor(bridges, props = {}) {
    super(bridges, props);
  }

  /**
   * Renders the line series plot layer into SVG.
   * @param {object} layout - Layout metrics.
   * @param {Function} xScale - Point scale for X.
   * @param {Function} yScale - Linear scale for Y.
   * @returns {string} SVG markup for line and area paths.
   */
  renderPlot(layout, xScale, yScale) {
    if (!this.plotData || this.plotData.length === 0) {
      return '';
    }

    const curveType = this.props.curve || 'smooth';
    const strokeWidth = Number(this.props.strokeWidth || this.props['stroke-width']) || 2.5;
    const showFill = this.isPropTrue('fill') || this.isPropTrue('gradient') || this.isPropTrue('area');
    const showDots = this.isPropTrue('dots');

    let markup = '<g class="ax-chart-lines">';

    this.seriesList.forEach((s, sIdx) => {
      if (s.hidden) return;

      const points = this.plotData.map((d) => {
        const seriesPoint = d.seriesCoords[s.key];
        return [d.xCoord, seriesPoint ? seriesPoint.yCoord : layout.plotBottom];
      });

      // 1. Area fill underneath the line
      if (showFill) {
        const areaD = generateAreaPath(points, layout.plotBottom, curveType);
        markup += `
          <path d="${areaD}" fill="url(#ax-grad-${sIdx})" class="ax-chart-area" opacity="0.9" />
        `;
      }

      // 2. Main line path
      let lineD = '';
      if (curveType === 'linear') {
        lineD = generateLinearPath(points);
      } else if (curveType === 'step') {
        lineD = generateStepPath(points, this.props.stepPosition || 'after');
      } else {
        lineD = generateSmoothPath(points, 0.33);
      }

      markup += `
        <path d="${lineD}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="ax-chart-line-path" />
      `;

      // 3. Optional point dots
      if (showDots) {
        markup += '<g class="ax-chart-dots">';
        points.forEach(([px, py]) => {
          markup += `
            <circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3.5" fill="${s.color}" stroke="${this.activeTheme.tooltipBg}" stroke-width="1.5" />
          `;
        });
        markup += '</g>';
      }
    });

    markup += '</g>';
    return markup;
  }
}
