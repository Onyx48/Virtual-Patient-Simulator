import { ParentSize } from "@visx/responsive";
import {
  Children,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { cn } from "@/lib/utils";
import { CHART_RESIZE_DEBOUNCE_MS } from "./chart-context";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase
} from "./chart-phase";
import { Line } from "./line";
import { TimeSeriesChartInner } from "./time-series-chart-shell";
const DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
const LINE_DOMAIN_EXCLUDED_NAMES = /* @__PURE__ */ new Set([
  "ProfitLossLine",
  "LineSeriesTerminalMarker",
  "Area",
  "SeriesBar",
  "Scatter",
  "Candlestick",
  "Bar",
  "PatternArea"
]);
function getChildComponentName(child) {
  const childType = child.type;
  return typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
}
function registersLineDomain(child, props) {
  if (!props?.dataKey) {
    return false;
  }
  const componentName = getChildComponentName(child);
  if (componentName === "Line" || child.type === Line) {
    return true;
  }
  if (LINE_DOMAIN_EXCLUDED_NAMES.has(componentName)) {
    return false;
  }
  return typeof props.dataKey === "string" && props.dataKey.length > 0;
}
function extractLineConfigs(children) {
  const configs = [];
  const visit = (node) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) {
        return;
      }
      const props = child.props;
      if (registersLineDomain(child, props) && props?.dataKey) {
        configs.push({
          dataKey: props.dataKey,
          stroke: props.stroke || "var(--chart-line-primary)",
          strokeWidth: props.strokeWidth || 2.5,
          yAxisId: props.yAxisId
        });
        return;
      }
      const childProps = child.props;
      if (childProps?.children) {
        visit(childProps.children);
      }
    });
  };
  visit(children);
  return configs;
}
function ChartInner({
  width,
  height,
  data,
  xDataKey,
  xLabelFormat,
  xTickLabelFormat,
  margin,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature,
  chartStatus,
  loadingLabel,
  yDomainTweenDuration,
  yDomainTween,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange,
  children,
  containerRef,
  onPhaseChange
,
  yScaleDomainMax}) {
  const lines = useMemo(() => extractLineConfigs(children), [children]);
  const clipPathId = `chart-grow-clip-${useId()}`;
  return <TimeSeriesChartInner
    animationDuration={animationDuration}
    animationEasing={animationEasing}
    chartStatus={chartStatus}
    clipPathId={clipPathId}
    containerRef={containerRef}
    data={data}
    enterTransition={enterTransition}
    height={height}
    lines={lines}
    loadingLabel={loadingLabel}
    margin={margin}
    onPhaseChange={onPhaseChange}
    revealSignature={revealSignature}
    tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
    width={width}
    xDataKey={xDataKey}
    xLabelFormat={xLabelFormat}
    xTickLabelFormat={xTickLabelFormat}
    xDomain={xDomain}
    xDomainSlotCount={xDomainSlotCount}
    yScaleDomainMax={yScaleDomainMax}
    yDomainTween={yDomainTween}
    yDomainTweenDuration={yDomainTweenDuration}
  >{children}</TimeSeriesChartInner>;
}
function LineChart({
  data,
  xDataKey = "date",
  xLabelFormat,
  xTickLabelFormat,
  margin: marginProp,
  animationDuration = 1100,
  animationEasing,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className = "",
  status = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  yDomainTween = true,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  style,
  onPhaseChange,
  yScaleDomainMax,
  children
}) {
  const containerRef = useRef(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const [chartPhase, setChartPhase] = useState(
    () => resolveRestingChartPhase(status)
  );
  const handlePhaseChange = useCallback(
    (phase) => {
      setChartPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange]
  );
  const showLoadingLabel = Boolean(
    loadingLabel?.trim() && (chartPhase === "loading" || chartPhase === "exiting" || chartPhase === "gridTweenReady" || chartPhase === "revealingLoading")
  );
  return <div
    className={cn("relative w-full", className)}
    ref={containerRef}
    style={{
      ...aspectRatio ? { aspectRatio } : void 0,
      touchAction: "none",
      ...style
    }}
  ><ParentSize debounceTime={CHART_RESIZE_DEBOUNCE_MS}>{({ width, height }) => <ChartInner
    animationDuration={animationDuration}
    animationEasing={animationEasing}
    chartStatus={status}
    containerRef={containerRef}
    data={data}
    enterTransition={enterTransition}
    height={height}
    loadingLabel={loadingLabel}
    margin={margin}
    onPhaseChange={handlePhaseChange}
    revealSignature={revealSignature}
    tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
    width={width}
    xDataKey={xDataKey}
    xLabelFormat={xLabelFormat}
    xTickLabelFormat={xTickLabelFormat}
    xDomain={xDomain}
    xDomainSlotCount={xDomainSlotCount}
    yDomainTween={yDomainTween}
    yDomainTweenDuration={yDomainTweenDuration}
    yScaleDomainMax={yScaleDomainMax}
  >{children}</ChartInner>}</ParentSize>{showLoadingLabel ? <ChartLoadingLabel
    exiting={chartPhase !== "loading"}
    text={loadingLabel}
  /> : null}</div>;
}
import { Line as Line2 } from "./line";
var line_chart_default = LineChart;
export {
  Line2 as Line,
  LineChart,
  line_chart_default as default
};
