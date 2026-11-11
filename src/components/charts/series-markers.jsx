import { useCallback, useMemo } from "react";
import { clipRevealTransition } from "./animation";
import {
  defaultScatterColors,
  useChartHover,
  useChartStable,
  useYScale
} from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import {
  getSeriesMarkerVisualExtent,
  SeriesPointMarker,
  StaticSeriesPointMarker
} from "./series-point-marker";
function SeriesMarkers({
  dataKey,
  fill,
  stroke,
  strokeWidth = 2,
  ringGap = 2,
  outlineWidth = 0,
  outlineColor,
  radius = 5,
  animate = true,
  fadeOnHover = true,
  inactiveOpacity = 0.5,
  inactiveBlur = 2,
  enterBlur = 2,
  showActiveHighlight = true
}) {
  const {
    data,
    xScale,
    innerWidth,
    enterTransition,
    animationDuration,
    revealEpoch,
    isLoaded,
    xAccessor,
    lines
  } = useChartStable();
  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);
  const seriesConfig = lines[seriesIndex];
  const yScale = useYScale(seriesConfig?.yAxisId);
  const seriesColor = defaultScatterColors[seriesIndex % defaultScatterColors.length] ?? defaultScatterColors[0];
  const resolvedFill = fill ?? seriesConfig?.stroke ?? seriesColor;
  const resolvedStroke = stroke ?? resolvedFill;
  const visualExtent = useMemo(
    () => getSeriesMarkerVisualExtent({
      radius,
      strokeWidth,
      ringGap,
      outlineWidth,
      showActiveHighlight
    }),
    [radius, strokeWidth, ringGap, outlineWidth, showActiveHighlight]
  );
  const revealDurationSec = clipRevealTransition(enterTransition).duration ?? animationDuration / 1e3;
  const enterDuration = 0.5;
  const isRevealing = animate && !isLoaded;
  const getY = useCallback(
    (d) => {
      const value = d[dataKey];
      return typeof value === "number" ? yScale(value) ?? 0 : null;
    },
    [dataKey, yScale]
  );
  const points = useMemo(
    () => data.flatMap((d, index) => {
      const cy = getY(d);
      if (cy === null) {
        return [];
      }
      const cx = xScale(xAccessor(d)) ?? 0;
      const leadingEdge = Math.max(0, cx - visualExtent);
      const revealDelay = innerWidth > 0 && isRevealing ? leadingEdge / innerWidth * revealDurationSec : 0;
      return [{ index, cx, cy, revealDelay }];
    }),
    [
      data,
      getY,
      xScale,
      xAccessor,
      innerWidth,
      isRevealing,
      revealDurationSec,
      visualExtent
    ]
  );
  const markerStyle = useMemo(
    () => ({
      fill: resolvedFill,
      stroke: resolvedStroke,
      strokeWidth,
      ringGap,
      outlineWidth,
      outlineColor,
      radius
    }),
    [
      resolvedFill,
      resolvedStroke,
      strokeWidth,
      ringGap,
      outlineWidth,
      outlineColor,
      radius
    ]
  );
  if (isRevealing) {
    return <g>{points.map((point) => <SeriesPointMarker
      cx={point.cx}
      cy={point.cy}
      dataKey={dataKey}
      enterBlur={enterBlur}
      enterDuration={enterDuration}
      index={point.index}
      key={`${dataKey}-${point.index}`}
      revealDelay={point.revealDelay}
      revealEpoch={revealEpoch ?? 0}
      {...markerStyle}
    />)}</g>;
  }
  const baseMarkers = points.map((point) => <StaticSeriesPointMarker
    cx={point.cx}
    cy={point.cy}
    key={`${dataKey}-${point.index}`}
    {...markerStyle}
  />);
  const activeScale = showActiveHighlight ? 1.35 : 1;
  return <g><SeriesMarkersDimWrapper
    enabled={fadeOnHover}
    inactiveBlur={inactiveBlur}
    inactiveOpacity={inactiveOpacity}
    seriesIndex={seriesIndex}
  >{baseMarkers}</SeriesMarkersDimWrapper><SeriesMarkersActiveHighlight
    activeScale={activeScale}
    enabled={fadeOnHover}
    markerStyle={markerStyle}
    points={points}
  /></g>;
}
SeriesMarkers.displayName = "SeriesMarkers";
function SeriesMarkersDimWrapper({
  enabled,
  inactiveOpacity,
  inactiveBlur,
  seriesIndex,
  children
}) {
  const { tooltipData } = useChartHover();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;
  const dimBase = enabled && (tooltipData !== null || isLegendDimmed);
  return <g
    opacity={dimBase ? inactiveOpacity : 1}
    style={{
      transition: "opacity 0.15s ease-in-out, filter 0.15s ease-in-out",
      filter: dimBase && inactiveBlur > 0 ? `blur(${inactiveBlur}px)` : "none"
    }}
  >{children}</g>;
}
function SeriesMarkersActiveHighlight({
  enabled,
  points,
  markerStyle,
  activeScale
}) {
  const { tooltipData } = useChartHover();
  if (!enabled || tooltipData === null) {
    return null;
  }
  const activePoint = points.find((point) => point.index === tooltipData.index);
  if (!activePoint) {
    return null;
  }
  return <StaticSeriesPointMarker
    cx={activePoint.cx}
    cy={activePoint.cy}
    scale={activeScale}
    {...markerStyle}
  />;
}
var series_markers_default = SeriesMarkers;
export {
  SeriesMarkers,
  series_markers_default as default
};
