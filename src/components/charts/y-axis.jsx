import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChartStable, useYScale } from "./chart-context";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import { resolveReferenceDataRange } from "./reference-area-geometry";
import { normalizeYAxisId } from "./y-axis-scales";
import {
  resolveYAxisTickCount,
  Y_AXIS_DEFAULT_TICK_COUNT
} from "./y-axis-ticks";
const Y_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;
function formatLabel(value, formatLargeNumbers, formatValue) {
  if (formatValue) {
    return formatValue(value);
  }
  if (formatLargeNumbers && value >= 1e3) {
    return `${(value / 1e3).toFixed(0)}k`;
  }
  return String(value);
}
function resolveTickLabelColor(tickY, axisId, yScale, referenceAreas) {
  for (const area of referenceAreas) {
    if (!area.axisLabelColor) {
      continue;
    }
    if (normalizeYAxisId(area.yAxisId) !== axisId) {
      continue;
    }
    const [low, high] = resolveReferenceDataRange(
      area.y1,
      area.y2,
      yScale.domain()
    );
    const topPixel = yScale(high) ?? 0;
    const bottomPixel = yScale(low) ?? 0;
    const bandTop = Math.min(topPixel, bottomPixel);
    const bandBottom = Math.max(topPixel, bottomPixel);
    if (tickY >= bandTop && tickY <= bandBottom) {
      return area.axisLabelColor;
    }
  }
  return void 0;
}
function YAxis(props) {
  const { containerRef } = useChartStable();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  return <YAxisInner {...props} container={container} />;
}
const YAxisInner = memo(function YAxisInner2({
  yAxisId,
  orientation = "left",
  numTicks = Y_AXIS_DEFAULT_TICK_COUNT,
  formatLargeNumbers = true,
  formatValue,
  container
}) {
  const { margin, referenceAreas } = useChartStable();
  const yScale = useYScale(yAxisId);
  const isLeft = orientation === "left";
  const axisId = normalizeYAxisId(yAxisId);
  const ticks = useMemo(() => {
    const tickValues = yScale.ticks(resolveYAxisTickCount(numTicks));
    return tickValues.map((value) => {
      const y = (yScale(value) ?? 0) + margin.top;
      return {
        value,
        y,
        label: formatLabel(value, formatLargeNumbers, formatValue),
        labelColor: resolveTickLabelColor(
          y - margin.top,
          axisId,
          yScale,
          referenceAreas
        )
      };
    });
  }, [
    yScale,
    margin.top,
    numTicks,
    formatLargeNumbers,
    formatValue,
    axisId,
    referenceAreas
  ]);
  return createPortal(
    <div className="pointer-events-none absolute inset-0"><div
      className="absolute top-0 bottom-0"
      style={isLeft ? { left: 0, width: margin.left } : { right: 0, width: margin.right }}
    >{ticks.map((tick) => <div
      className="absolute flex items-center"
      key={tick.value}
      style={{
        top: tick.y,
        transform: "translateY(-50%)",
        transition: `top ${Y_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")})`,
        ...isLeft ? { right: 0, justifyContent: "flex-end", paddingRight: 8 } : { left: 0, justifyContent: "flex-start", paddingLeft: 8 }
      }}
    ><span
      className="text-chart-label text-xs"
      style={tick.labelColor ? { color: tick.labelColor } : void 0}
    >{tick.label}</span></div>)}</div></div>,
    container
  );
});
YAxis.displayName = "YAxis";
var y_axis_default = YAxis;
export {
  YAxis,
  y_axis_default as default
};
