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
import { Area } from "./area";
import { CHART_RESIZE_DEBOUNCE_MS } from "./chart-context";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase
} from "./chart-phase";
import { PatternArea } from "./pattern-area";
import { TimeSeriesChartInner } from "./time-series-chart-shell";
const DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
function extractAreaConfigs(children) {
  const configs = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    const childType = child.type;
    const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
    const props = child.props;
    const isPatternArea = componentName === "PatternArea" || child.type === PatternArea;
    const isAreaComponent = componentName === "Area" || child.type === Area || props && typeof props.dataKey === "string" && props.dataKey.length > 0 && !isPatternArea;
    if (isAreaComponent && props?.dataKey) {
      configs.push({
        dataKey: props.dataKey,
        stroke: props.stroke || props.fill || "var(--chart-line-primary)",
        strokeWidth: props.strokeWidth || 2,
        yAxisId: props.yAxisId
      });
    }
  });
  return configs;
}
function ChartInner({
  width,
  height,
  data,
  xDataKey,
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
}) {
  const lines = useMemo(() => extractAreaConfigs(children), [children]);
  const clipPathId = `chart-area-grow-clip-${useId()}`;
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
    xDomain={xDomain}
    xDomainSlotCount={xDomainSlotCount}
    yDomainTween={yDomainTween}
    yDomainTweenDuration={yDomainTweenDuration}
  >{children}</TimeSeriesChartInner>;
}
function AreaChart({
  data,
  xDataKey = "date",
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
    style={{ aspectRatio, touchAction: "none", ...style }}
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
    xDomain={xDomain}
    xDomainSlotCount={xDomainSlotCount}
    yDomainTween={yDomainTween}
    yDomainTweenDuration={yDomainTweenDuration}
  >{children}</ChartInner>}</ParentSize>{showLoadingLabel ? <ChartLoadingLabel
    exiting={chartPhase !== "loading"}
    text={loadingLabel}
  /> : null}</div>;
}
import { Area as Area2 } from "./area";
var area_chart_default = AreaChart;
export {
  Area2 as Area,
  AreaChart,
  area_chart_default as default
};
