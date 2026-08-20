import assert from 'assert';
import '../../../test/helpers/register-happy-dom.js';
import { AvenxApp } from '../../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../../lib/core/runtime/AvenxPage.js';
import {
  avenxCharts,
  ChartLine,
  BaseChart,
  createLinearScale,
  createPointScale,
  createBandScale,
  generateLinearTicks,
  getExtent,
  generateSmoothPath,
  generateLinearPath,
  generateAreaPath,
  generateGridLines,
  chartsPreprocessor,
  parseChartAttributes,
  formatValue,
  resolveTheme,
  findNearestIndex,
} from '../src/index.js';

/**
 * Runs the test suite for avenx-charts.
 */
async function runChartTests() {
  console.log('🧪 Starting Avenx Charts Plugin Test Suite...\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Scales and Extent Calculation Tests
    // -------------------------------------------------------------------------
    console.log('  1. Testing scales and extent calculations...');
    const data = [
      { month: 'Jan', sales: 120, expenses: 80 },
      { month: 'Feb', sales: 240, expenses: 140 },
      { month: 'Mar', sales: 360, expenses: 200 },
    ];

    const [minY, maxY] = getExtent(data, ['sales', 'expenses']);
    assert.strictEqual(minY, 0, 'Min Y should be 0 when includeZero is true');
    assert.strictEqual(maxY, 360, 'Max Y should be 360');

    const linearScale = createLinearScale([0, 360], [300, 20]);
    assert.strictEqual(linearScale(0), 300, '0 maps to range bottom');
    assert.strictEqual(linearScale(linearScale.domain[1]), 20, 'Domain max maps to range top');

    const exactScale = createLinearScale([0, 360], [300, 20], { nice: false });
    assert.strictEqual(exactScale(360), 20, '360 maps to range top when nice=false');

    const ticks = linearScale.ticks(5);
    assert(Array.isArray(ticks), 'Ticks should return array');
    assert(ticks.length >= 3, 'Ticks should return multiple values');

    const pointScale = createPointScale(['Jan', 'Feb', 'Mar'], [50, 550]);
    assert(pointScale('Jan') < pointScale('Feb'), 'Jan x position is before Feb');
    assert(pointScale('Feb') < pointScale('Mar'), 'Feb x position is before Mar');

    const bandScale = createBandScale(['A', 'B', 'C'], [0, 300]);
    assert(bandScale.bandwidth() > 0, 'Bandwidth must be positive');
    console.log('  ✅ Scales and extent calculations passed!');

    // -------------------------------------------------------------------------
    // 2. SVG Shape and Path Generator Tests
    // -------------------------------------------------------------------------
    console.log('  2. Testing SVG shape and path generators...');
    const points = [
      [50, 250],
      [200, 150],
      [350, 80],
    ];

    const linearPath = generateLinearPath(points);
    assert(linearPath.startsWith('M 50,250 L 200,150 L 350,80'), 'Linear path matches points');

    const smoothPath = generateSmoothPath(points);
    assert(smoothPath.includes('C'), 'Smooth path uses cubic Bezier C commands');

    const areaPath = generateAreaPath(points, 300, 'smooth');
    assert(areaPath.endsWith('L 350,300 L 50,300 Z'), 'Area path closes down to baseline and Z');

    const gridPath = generateGridLines([], [100, 200], [50, 550], [20, 300]);
    assert(gridPath.includes('M 50,100'), 'Grid lines contain horizontal segments');
    console.log('  ✅ SVG shape generators passed!');

    // -------------------------------------------------------------------------
    // 3. Theme, Colors, and Value Formatting Tests
    // -------------------------------------------------------------------------
    console.log('  3. Testing theme and value formatting...');
    const lightTheme = resolveTheme('light');
    assert.strictEqual(lightTheme.fontFamily.includes('sans-serif'), true);

    const darkTheme = resolveTheme('dark');
    assert.strictEqual(darkTheme.textColor, '#cbd5e1');

    assert.strictEqual(formatValue(1500), '1.5k');
    assert.strictEqual(formatValue(2500000), '2.5M');
    assert.strictEqual(formatValue(42), '42');
    assert.strictEqual(formatValue(null), '–');
    console.log('  ✅ Theme and formatting passed!');

    // -------------------------------------------------------------------------
    // 4. Preprocessor and Attribute Parsing Tests
    // -------------------------------------------------------------------------
    console.log('  4. Testing charts preprocessor...');
    const rawTemplate = `
      <div class="card">
        <chart.line
          data={sales}
          x="month"
          y="value"
          grid
          legend
          tooltip
        />
      </div>
    `;

    const processed = chartsPreprocessor(rawTemplate);
    assert(
      processed.includes('data-avenx-comp="chart.line"'),
      'Preprocessor converted tag to data-avenx-comp="chart.line"'
    );
    assert(processed.includes('data-props-data="sales"'), 'Preserved data={sales} binding');
    assert(processed.includes('data-props-x="\'month\'"'), 'Preserved x="month" prop');
    assert(processed.includes('data-props-y="\'value\'"'), 'Preserved y="value" prop');
    assert(processed.includes('data-props-grid="true"'), 'Parsed boolean grid flag');
    assert(processed.includes('data-props-legend="true"'), 'Parsed boolean legend flag');
    assert(processed.includes('data-props-tooltip="true"'), 'Parsed boolean tooltip flag');

    const attrs = parseChartAttributes('data={{ sales }} x="category" grid');
    assert.strictEqual(attrs.data, '{{ sales }}');
    assert.strictEqual(attrs.x, 'category');
    assert.strictEqual(attrs.grid, 'true');
    console.log('  ✅ Preprocessor passed!');

    // -------------------------------------------------------------------------
    // 5. Plugin Installation on AvenxApp
    // -------------------------------------------------------------------------
    console.log('  5. Testing plugin installation in AvenxApp...');
    const mountTarget = document.createElement('div');
    mountTarget.id = 'app-root';
    document.body.appendChild(mountTarget);

    const app = new AvenxApp({ target: '#app-root' });
    app.use(avenxCharts);

    assert(app.components.has('chart.line'), 'app.components has chart.line');
    assert(app.components.has('ChartLine'), 'app.components has ChartLine');
    assert(app.components.has('chart-line'), 'app.components has chart-line');
    assert(app.components.has('BaseChart'), 'app.components has BaseChart');
    console.log('  ✅ Plugin installation passed!');

    // -------------------------------------------------------------------------
    // 6. Component Mounting & SVG Output
    // -------------------------------------------------------------------------
    console.log('  6. Testing ChartLine mounting and SVG rendering...');
    const chartContainer = document.createElement('div');
    document.body.appendChild(chartContainer);

    const sampleSales = [
      { month: 'Jan', value: 100 },
      { month: 'Feb', value: 250 },
      { month: 'Mar', value: 180 },
      { month: 'Apr', value: 420 },
    ];

    const chartInstance = new ChartLine({}, {
      data: sampleSales,
      x: 'month',
      y: 'value',
      grid: true,
      legend: true,
      tooltip: true,
      dots: true,
      fill: true,
    });

    chartInstance.mount(chartContainer);

    const svg = chartContainer.querySelector('svg');
    assert(svg !== null, 'ChartLine rendered an SVG element');
    assert(svg.querySelector('.ax-chart-lines') !== null, 'SVG contains line plot group');
    assert(svg.querySelector('.ax-chart-grid') !== null, 'SVG contains grid lines');
    assert(svg.querySelector('.ax-chart-axes') !== null, 'SVG contains axes');
    assert(svg.querySelector('.ax-chart-dots') !== null, 'SVG contains data dots');

    const legend = chartContainer.querySelector('.ax-chart-legend');
    assert(legend !== null, 'Legend element rendered');
    assert(legend.textContent.includes('Value'), 'Legend contains series name');
    console.log('  ✅ ChartLine mounting and SVG rendering passed!');

    // -------------------------------------------------------------------------
    // 7. Reactive Data Updates (setProps)
    // -------------------------------------------------------------------------
    console.log('  7. Testing reactivity and automatic updates...');
    const updatedSales = [
      { month: 'Jan', value: 100 },
      { month: 'Feb', value: 250 },
      { month: 'Mar', value: 180 },
      { month: 'Apr', value: 420 },
      { month: 'May', value: 650 },
    ];

    chartInstance.setProps({
      data: updatedSales,
      x: 'month',
      y: 'value',
      grid: true,
      legend: true,
      tooltip: true,
      dots: true,
      fill: true,
    });

    await chartInstance.nextTick();

    assert.strictEqual(chartInstance.plotData.length, 5, 'Plot data reactively updated to 5 points');
    assert.strictEqual(chartInstance.plotData[4].xVal, 'May', 'Fifth point is May');
    console.log('  ✅ Reactive data updates passed!');

    // -------------------------------------------------------------------------
    // 8. Hit-Testing & Tooltip Navigation
    // -------------------------------------------------------------------------
    console.log('  8. Testing tooltip nearest point calculation...');
    const nearest = findNearestIndex(chartInstance.plotData[2].xCoord + 2, chartInstance.plotData);
    assert.strictEqual(nearest, 2, 'Finds closest data point index');
    console.log('  ✅ Tooltip hit-testing passed!');

    // -------------------------------------------------------------------------
    // 9. Unmount & Cleanup
    // -------------------------------------------------------------------------
    console.log('  9. Testing component unmount and cleanup...');
    chartInstance.unmount();
    console.log('  ✅ Unmount and cleanup passed!');

    console.log('\n🎉 ALL AVENX CHARTS PLUGIN TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    throw err;
  }
}

runChartTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failure in Avenx Charts Plugin:');
    console.error(err);
    process.exit(1);
  });
