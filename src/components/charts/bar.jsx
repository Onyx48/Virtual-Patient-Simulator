import { motion } from "motion/react";
import { memo, useId, useMemo } from "react";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import {
  chartCssVars,
  useChart,
  useChartStable,
  useYScale
} from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import { transitionWithDelay } from "./motion-utils";
function barDepthPerspectiveRise(barScale, bandWidth, barXAccessor, innerWidth, datum, topY, baselineY) {
  const centerX = innerWidth / 2;
  if (centerX <= 0) {
    return 0;
  }
  const step = barScale.step?.() ?? bandWidth;
  const maxDepth = barDepthMaxDepth(step, bandWidth);
  const bandX = barScale(barXAccessor(datum)) ?? 0;
  const cx = bandX + bandWidth / 2;
  const absOffset = Math.min(1, Math.abs((cx - centerX) / centerX));
  const naturalHeight = Math.abs(baselineY - topY);
  return barDepthAndRise(absOffset, naturalHeight, maxDepth).perspectiveRise;
}
function AnimatedBar({
  x,
  y,
  width,
  height,
  fill,
  rx,
  ry,
  index,
  isFaded,
  animationType,
  innerHeight,
  fadedOpacity,
  staggerDelay,
  enterTransition,
  revealEpoch,
  isHorizontal
}) {
  const enterAnim = transitionWithDelay(enterTransition, index * staggerDelay);
  if (animationType === "fade") {
    return <motion.rect
      animate={{
        opacity: isFaded ? fadedOpacity : 1,
        filter: "blur(0px)"
      }}
      fill={fill}
      height={height}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      key={`fade-${index}-${revealEpoch}`}
      rx={rx}
      ry={ry}
      transition={enterAnim}
      width={width}
      x={x}
      y={y}
    />;
  }
  const initial = isHorizontal ? { width: 0, height, x: 0, y } : { width, height: 0, x, y: innerHeight };
  const target = isHorizontal ? { width, height, x: 0, y } : { width, height, x, y };
  return <g
    opacity={isFaded ? fadedOpacity : 1}
    style={{ transition: "opacity 0.15s ease-in-out" }}
  ><motion.rect
    animate={target}
    fill={fill}
    initial={initial}
    key={`grow-${index}-${revealEpoch}`}
    rx={rx}
    ry={ry}
    transition={enterAnim}
  /></g>;
}
const BarInner = memo(function BarInner2({
  dataKey,
  yAxisId,
  fill = chartCssVars.linePrimary,
  lineCap = "round",
  animate = true,
  animationType = "grow",
  fadedOpacity = 0.3,
  staggerDelay,
  stackGap = 0,
  groupGap = 4,
  perspective = false,
  minBarHeight = 0,
  overlayOf,
  barScale,
  bandWidth,
  barXAccessor
}) {
  const {
    data,
    yScale: chartYScale,
    innerHeight,
    innerWidth,
    isLoaded,
    hoveredBarIndex,
    lines,
    orientation,
    stacked,
    stackOffsets,
    animationDuration,
    enterTransition,
    revealEpoch = 0
  } = useChart();
  const totalAnimDuration = animationDuration || 1100;
  const staggerSpread = totalAnimDuration * 0.4;
  const calculatedStaggerDelay = staggerDelay ?? (data.length > 1 ? staggerSpread / 1e3 / data.length : 0);
  const uniqueId = useId();
  const isHorizontal = orientation === "horizontal";
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const seriesIndex = useMemo(() => {
    const idx = lines.findIndex((l) => l.dataKey === dataKey);
    return idx >= 0 ? idx : 0;
  }, [lines, dataKey]);
  const seriesConfig = lines[seriesIndex];
  const valueScale = useYScale(yAxisId ?? seriesConfig?.yAxisId);
  const isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;
  const { slotCount, slotIndex } = useMemo(() => {
    const slots = lines.filter((line) => !line.overlayOf).map((line) => line.dataKey);
    const key = overlayOf ?? dataKey;
    const index = slots.indexOf(key);
    return { slotCount: slots.length, slotIndex: index >= 0 ? index : 0 };
  }, [lines, dataKey, overlayOf]);
  const seriesCount = slotCount;
  const isLastSeries = seriesIndex === lines.length - 1;
  const barWidth = useMemo(() => {
    if (!bandWidth || seriesCount === 0) {
      return 0;
    }
    if (stacked) {
      return bandWidth;
    }
    const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
    return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
  }, [bandWidth, seriesCount, stacked, groupGap]);
  const cornerRadius = useMemo(() => {
    if (perspective) {
      return 0;
    }
    if (typeof lineCap === "number") {
      return lineCap;
    }
    if (lineCap === "round" && barWidth) {
      return Math.min(barWidth / 2, 8);
    }
    return 0;
  }, [lineCap, barWidth, perspective]);
  return <g className={`bar-series-${uniqueId}`}>{data.map((d, i) => {
    const value = d[dataKey];
    if (typeof value !== "number") {
      return null;
    }
    const categoryValue = barXAccessor(d);
    const bandPos = barScale(categoryValue) ?? 0;
    let x;
    let y;
    let barHeight;
    let barW;
    const scale = isHorizontal ? chartYScale : valueScale;
    if (isHorizontal) {
      const valuePos = scale(value) ?? 0;
      barW = valuePos;
      barHeight = barWidth;
      if (stacked && stackOffsets) {
        const offset = stackOffsets.get(i)?.get(dataKey) ?? 0;
        x = scale(offset) ?? 0;
        barW = valuePos - x;
        const gapOffset = seriesIndex * stackGap;
        x += gapOffset;
        if (!isLastSeries && stackGap > 0) {
          barW = Math.max(0, barW - stackGap);
        }
      } else {
        x = 0;
        const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
        y = bandPos + slotIndex * (barWidth + effectiveGroupGap);
      }
      y = stacked ? bandPos : bandPos + slotIndex * (barWidth + (seriesCount > 1 ? groupGap : 0));
    } else {
      const valuePos = scale(value) ?? 0;
      barHeight = innerHeight - valuePos;
      barW = barWidth;
      if (stacked && stackOffsets) {
        const offset = stackOffsets.get(i)?.get(dataKey) ?? 0;
        const offsetY = scale(offset) ?? innerHeight;
        const gapOffset = seriesIndex * stackGap;
        y = offsetY - barHeight - gapOffset;
        if (!isLastSeries && stackGap > 0) {
          barHeight = Math.max(0, barHeight - stackGap);
        }
      } else {
        y = valuePos;
        const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
        x = bandPos + slotIndex * (barWidth + effectiveGroupGap);
      }
      x = stacked ? bandPos : bandPos + slotIndex * (barWidth + (seriesCount > 1 ? groupGap : 0));
      let isFloored = false;
      if (!stacked && minBarHeight > 0 && value >= 0 && barHeight < minBarHeight) {
        const baselineY = scale(0) ?? innerHeight;
        barHeight = minBarHeight;
        y = baselineY - minBarHeight;
        isFloored = true;
      }
      if (perspective && value > 0 && !isFloored && (!stacked || isLastSeries)) {
        const baselineY = scale(0) ?? innerHeight;
        const rise = barDepthPerspectiveRise(
          barScale,
          bandWidth,
          barXAccessor,
          innerWidth,
          d,
          y,
          baselineY
        );
        const trim = Math.min(rise, Math.max(0, barHeight - 1));
        y += trim;
        barHeight -= trim;
      }
    }
    const isFaded = hoveredBarIndex !== null && hoveredBarIndex !== i || isLegendDimmed;
    const barKey = `bar-${dataKey}-${categoryValue}`;
    const applyRounding = !stacked || stackGap > 0 || isLastSeries;
    const effectiveRx = applyRounding ? cornerRadius : 0;
    const effectiveRy = applyRounding ? cornerRadius : 0;
    const resolvedFill = typeof fill === "function" ? fill(d, i) : fill;
    if (animate && !isLoaded) {
      return <AnimatedBar
        animationType={animationType}
        enterTransition={enterTransition}
        fadedOpacity={fadedOpacity}
        fill={resolvedFill}
        height={barHeight}
        index={i}
        innerHeight={innerHeight}
        isFaded={isFaded}
        isHorizontal={isHorizontal}
        key={barKey}
        revealEpoch={revealEpoch}
        rx={effectiveRx}
        ry={effectiveRy}
        staggerDelay={calculatedStaggerDelay}
        width={barW}
        x={x}
        y={y}
      />;
    }
    return <rect
      fill={resolvedFill}
      height={barHeight}
      key={barKey}
      opacity={isFaded ? fadedOpacity : 1}
      rx={effectiveRx}
      ry={effectiveRy}
      style={{
        cursor: "default",
        transition: "opacity 0.15s ease-in-out"
      }}
      width={barW}
      x={x}
      y={y}
    />;
  })}</g>;
});
function Bar(props) {
  const { barScale, bandWidth, barXAccessor } = useChartStable();
  if (!(barScale && bandWidth && barXAccessor)) {
    console.warn("Bar component must be used within a BarChart");
    return null;
  }
  return <BarInner
    {...props}
    bandWidth={bandWidth}
    barScale={barScale}
    barXAccessor={barXAccessor}
  />;
}
Bar.displayName = "Bar";
var bar_default = Bar;
export {
  Bar,
  bar_default as default
};
