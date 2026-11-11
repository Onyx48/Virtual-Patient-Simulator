import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChartStable, useYScale } from "./chart-context";
import { resolveYAxisTickCount, Y_AXIS_DEFAULT_TICK_COUNT } from "./y-axis-ticks";
function BarValueAxis(props) {
  const { containerRef } = useChartStable();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  return <BarValueAxisInner {...props} container={container} />;
}
const BarValueAxisInner = memo(function BarValueAxisInner2({
  yAxisId,
  numTicks = Y_AXIS_DEFAULT_TICK_COUNT,
  tickValues,
  formatValue,
  container
}) {
  const { margin } = useChartStable();
  const valueScale = useYScale(yAxisId);
  const ticks = useMemo(() => {
    const values = tickValues ?? valueScale.ticks(resolveYAxisTickCount(numTicks));
    return values.map((value) => ({
      value,
      // A horizontal chart's value scale spans the plot width, so this is an x.
      x: (valueScale(value) ?? 0) + margin.left,
      label: formatValue ? formatValue(value) : String(value)
    }));
  }, [valueScale, margin.left, numTicks, tickValues, formatValue]);
  return createPortal(
    <div className="pointer-events-none absolute inset-0">{ticks.map((tick) => (
      // Zero-width flex box, so the label centres on the tick rather than
      // starting at it — the trick `BarXAxis` uses for the same reason.
      <div
        className="absolute flex justify-center"
        key={tick.value}
        style={{ left: tick.x, bottom: 12, width: 0 }}
      ><span className="whitespace-nowrap text-chart-label text-xs">{tick.label}</span></div>
    ))}</div>,
    container
  );
});
BarValueAxis.displayName = "BarValueAxis";
var bar_value_axis_default = BarValueAxis;
export {
  BarValueAxis,
  bar_value_axis_default as default
};
