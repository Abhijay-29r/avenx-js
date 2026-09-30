// Type definitions for @avenx/charts
// Project: Avenx-JS
// Definitions by: Avenx Team

export type Point = [number, number];

export interface AvenxApp {
  register(name: string, component: typeof BaseChart): void;
  components: {
    has(name: string): boolean;
  };
}

export interface AvenxPlugin {
  install(app: AvenxApp, options?: Record<string, unknown>): void;
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                      */
/* -------------------------------------------------------------------------- */

export interface AvenxChartsPlugin extends AvenxPlugin {
  options?: Record<string, unknown>;
}

export const CHART_TYPES: {
  line: typeof ChartLine;
};

export const avenxCharts: AvenxChartsPlugin;

export function createAvenxCharts(
  options?: Record<string, unknown>
): AvenxPlugin;

export default avenxCharts;

/* -------------------------------------------------------------------------- */
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

export class BaseChart {
  constructor(
    bridges?: Record<string, unknown>,
    props?: Record<string, unknown>
  );

  onMount(): void;
  onUpdate(): void;
  onDestroy(): void;

  initResizeObserver(): void;
  attachEventListeners(): void;
  detachEventListeners(): void;

  onPointerMove(event: MouseEvent | TouchEvent): void;
  onPointerLeave(): void;
  onLegendClick(event: MouseEvent): void;

  isPropTrue(propName: string): boolean;
  getData(): unknown[];
  getLayout(): Record<string, number | object>;

  renderChart(): void;
  renderDefs(layout: unknown, seriesList: unknown[]): string;
  renderAxes(
    layout: unknown,
    xScale: unknown,
    yScale: unknown,
    xCategories: string[]
  ): string;
  renderPlot(...args: unknown[]): string;
  renderInteractiveOverlayMarkup(layout: unknown): string;
  updateInteractiveOverlay(): void;
  updateTooltipDOM(
    activeItem: unknown,
    mouseX: number,
    mouseY: number
  ): void;
}

export class ChartLine extends BaseChart {
  constructor(
    bridges?: Record<string, unknown>,
    props?: Record<string, unknown>
  );

  renderPlot(layout: unknown): string;
}

/* -------------------------------------------------------------------------- */
/* Preprocessor                                                                */
/* -------------------------------------------------------------------------- */

export function parseChartAttributes(
  attrStr: string
): Record<string, string>;

export function chartsPreprocessor(template: string): string;

/* -------------------------------------------------------------------------- */
/* Scales                                                                      */
/* -------------------------------------------------------------------------- */

export interface LinearScale {
  (value: number): number;
  domain: number[];
  range: number[];
  invert(value: number): number;
  ticks(count?: number): number[];
}

export interface PointScale<T = string | number> {
  (value: T): number;
  domain: T[];
  range: number[];
  step(): number;
  ticks(): T[];
}

export interface BandScale<T = string | number> {
  (value: T): number;
  domain: T[];
  range: number[];
  bandwidth(): number;
  step(): number;
  ticks(): T[];
}

export interface LinearScaleOptions {
  clamp?: boolean;
  nice?: boolean;
  tickCount?: number;
}

export interface PointScaleOptions {
  padding?: number;
}

export interface BandScaleOptions {
  paddingInner?: number;
  paddingOuter?: number;
}

export function niceNum(
  x: number,
  round?: boolean
): number;

export function generateLinearTicks(
  min: number,
  max: number,
  tickCount?: number
): number[];

export function createLinearScale(
  domain: number[],
  range: number[],
  options?: LinearScaleOptions
): LinearScale;

export function createPointScale<T extends string | number>(
  domain: T[],
  range: number[],
  options?: PointScaleOptions
): PointScale<T>;

export function createBandScale<T extends string | number>(
  domain: T[],
  range: number[],
  options?: BandScaleOptions
): BandScale<T>;

export function getExtent(
  data: Record<string, unknown>[],
  keys: string | string[],
  options?: {
    includeZero?: boolean;
  }
): [number, number];

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

export function generateLinearPath(
  points: Point[]
): string;

export function generateSmoothPath(
  points: Point[],
  tension?: number
): string;

export function generateStepPath(
  points: Point[],
  stepPosition?: 'after' | 'before' | 'middle'
): string;

export function generateAreaPath(
  points: Point[],
  baselineY: number,
  curve?: 'smooth' | 'linear' | 'step'
): string;

export function generateGridLines(
  xCoords: number[],
  yCoords: number[],
  xRange: [number, number],
  yRange: [number, number],
  options?: {
    horizontal?: boolean;
    vertical?: boolean;
  }
): string;

/* -------------------------------------------------------------------------- */
/* Theme                                                                       */
/* -------------------------------------------------------------------------- */

export const PALETTES: Record<string, string[]>;

export interface Theme {
  background: string;
  textColor: string;
  textMuted: string;
  gridColor: string;
  axisColor: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
  tooltipShadow: string;
  crosshairColor: string;
  fontFamily: string;
  fontSize: string;
  mode?: string;
  [key: string]: unknown;
}

export const THEMES: {
  light: Theme;
  dark: Theme;
};

export function getColor(
  palette: string[] | string,
  index?: number
): string;

export function resolveTheme(
  theme?: string | Partial<Theme>
): Theme;

export function formatValue(
  value: number,
  options?: {
    prefix?: string;
    suffix?: string;
    precision?: number;
  }
): string;

/* -------------------------------------------------------------------------- */
/* Legend                                                                      */
/* -------------------------------------------------------------------------- */

export interface SeriesConfig {
  key: string;
  name?: string;
  color?: string;
  hidden?: boolean;
}

export function normalizeSeries(
  rawSeries: string | string[] | SeriesConfig[],
  palette?: string[] | string
): SeriesConfig[];

export function renderLegendHtml(
  seriesList: SeriesConfig[],
  theme?: Partial<Theme>
): string;

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

export interface TooltipPoint {
  xCoord: number;
  [key: string]: unknown;
}

export function findNearestIndex(
  mouseX: number,
  points: TooltipPoint[]
): number;

export interface TooltipItem {
  name: string;
  value: unknown;
  color: string;
}

export interface TooltipInfo {
  title: string | number;
  items: TooltipItem[];
}

export function renderTooltipContent(
  info: TooltipInfo,
  theme?: Partial<Theme>
): string;

export function calculateTooltipPosition(
  targetX: number,
  targetY: number,
  containerWidth: number,
  containerHeight: number,
  tooltipWidth?: number,
  tooltipHeight?: number
): {
  left: number;
  top: number;
};