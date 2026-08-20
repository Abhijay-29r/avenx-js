# @avenx/charts

Official, declarative, reactive charting plugin for [Avenx.js](https://github.com/avenx-js/avenx-js).

`@avenx/charts` provides first-class charting components that feel native to Avenx.js, automatically re-rendering when reactive state shifts without requiring manual imperative setup or external charting wrappers.

---

## Features

- **Declarative Syntax**: Use intuitive `<chart.line ... />` tags directly in your Avenx templates.
- **Deep Avenx Reactivity**: Automatically tracks Avenx reactive state and array mutations (e.g. `this.state.sales.push(...)`).
- **Smooth Vector Graphics**: Pure SVG rendering with responsive `viewBox` scaling, Catmull-Rom cubic Bezier curve smoothing, and gradient area fills.
- **Interactive Tooltips**: High-performance pointer tracking and hit-testing displaying nearest series values with crosshair guides.
- **Configurable Axes & Grid**: Automatic "nice" tick calculation, formatted labels, and customizable gridlines.
- **Extensible Base Architecture**: Built on `BaseChart` extending `AvenxComponent`, designed for future chart types (`chart.bar`, `chart.area`, `chart.pie`, `chart.donut`, `chart.scatter`).

---

## Installation & Setup

### 1. Install Plugin in Avenx Application

In your `src/main.app.js`:

```javascript
import { AvenxApp } from 'avenx-core/runtime';
import { avenxCharts } from '@avenx/charts';

const app = new AvenxApp({ target: '#app' });

// Install official charts plugin
app.use(avenxCharts);
```

### 2. Configure Compiler Preprocessor (Optional)

To enable `<chart.line ... />` syntax in Single-File Components and templates, configure the preprocessor in `avenx.config.json`:

```json
{
  "preprocessors": {
    "template": "@avenx/charts/preprocessor"
  }
}
```

Or import `chartsPreprocessor` in your code:

```javascript
import { chartsPreprocessor } from '@avenx/charts';
```

---

## Usage Example

```html
<!-- src/pages/dashboard.page.js -->
<div class="dashboard-card">
  <h2>Monthly Sales</h2>

  <chart.line
    data={sales}
    x="month"
    y="value"
    grid
    legend
    tooltip
  />
</div>
```

```javascript
export class DashboardPage extends AvenxPage {
  constructor(bridges, componentRegistry) {
    super(
      {
        sales: [
          { month: 'Jan', value: 120 },
          { month: 'Feb', value: 240 },
          { month: 'Mar', value: 310 },
          { month: 'Apr', value: 450 },
        ],
      },
      {},
      bridges,
      template,
      {},
      componentRegistry
    );
  }

  // Any reactive update triggers an automatic redraw:
  addPoint(month, value) {
    this.state.sales.push({ month, value });
  }
}
```

---

## Component Properties (`<chart.line />`)

| Property | Type | Default | Description |
|---|---|---|---|
| `data` | `Array<object>` | `[]` | Reactive dataset array. |
| `x` | `string` | `'x'` | Key in dataset objects for X-axis categories. |
| `y` | `string \| Array<string>` | `'value'` | Key(s) in dataset objects for Y-axis numerical values. |
| `grid` | `boolean` | `false` | Enables horizontal grid lines. |
| `legend` | `boolean` | `false` | Enables series legend with interactive toggles. |
| `tooltip` | `boolean` | `false` | Enables interactive hover crosshair and tooltip card. |
| `curve` | `'smooth' \| 'linear' \| 'step'` | `'smooth'` | Line interpolation curve type. |
| `fill` | `boolean` | `false` | Enables subtle gradient area fill underneath the line. |
| `dots` | `boolean` | `false` | Displays circular markers on data points. |
| `theme` | `'light' \| 'dark' \| object` | `'light'` | Theme preset or custom theme overrides. |
| `colors` | `string \| Array<string>` | `'default'` | Named color palette (`'default'`, `'modern'`, `'neon'`) or array of hex codes. |
| `width` | `number` | `600` | SVG viewBox width. |
| `height` | `number` | `320` | SVG viewBox height. |

---

## Multi-Series Line Charts

Plot multiple series simultaneously by providing an array of keys to `y`:

```html
<chart.line
  data={metrics}
  x="month"
  y="['revenue', 'profit', 'expenses']"
  grid
  legend
  tooltip
/>
```

---

## Architecture & Adding New Chart Types

All charts inherit from `BaseChart` (`AvenxComponent`), which manages:
- Responsive `ResizeObserver` container sizing.
- Reactive `this.props` change detection and lifecycle teardown.
- Coordinate transformation (`createLinearScale`, `createPointScale`, `createBandScale`).
- Interactive overlay rendering and DOM tooltip positioning.

To create a new chart type (e.g. `ChartBar`):

```javascript
import { BaseChart } from '@avenx/charts';

export class ChartBar extends BaseChart {
  renderPlot(layout, xScale, yScale) {
    // Custom bar rendering logic using this.plotData and layout metrics
    return '<g class="ax-chart-bars">...</g>';
  }
}
```

---

## License

MIT © [Avenx Team](https://avenx-js.com/)
