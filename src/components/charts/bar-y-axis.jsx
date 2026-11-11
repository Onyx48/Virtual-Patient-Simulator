import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useChart, useChartStable } from "./chart-context";
function BarYAxisLabel({
  label,
  y,
  bandHeight,
  isHovered,
  labelMaxWidth
}) {
  return <div
    className="absolute right-0 flex items-center justify-end pr-2"
    style={{
      top: y,
      height: bandHeight
    }}
  ><motion.span
    animate={{
      opacity: isHovered ? 1 : 0.7,
      color: isHovered ? "var(--foreground)" : "var(--chart-label, var(--color-zinc-500))"
    }}
    className={cn("truncate whitespace-nowrap text-right text-xs")}
    initial={{
      opacity: 0.7,
      color: "var(--chart-label, var(--color-zinc-500))"
    }}
    style={{ maxWidth: labelMaxWidth }}
    transition={{ duration: 0.15 }}
  >{label}</motion.span></div>;
}
function BarYAxis(props) {
  const { containerRef, barScale } = useChartStable();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!barScale) {
    return null;
  }
  return <BarYAxisInner {...props} container={container} />;
}
const BarYAxisInner = memo(function BarYAxisInner2({
  showAllLabels = true,
  maxLabels = 20,
  labelMaxWidth = 70,
  container
}) {
  const { margin, barScale, bandWidth, barXAccessor, data, hoveredBarIndex } = useChart();
  const labelsToShow = useMemo(() => {
    if (!(barScale && bandWidth && barXAccessor)) {
      return [];
    }
    const allLabels = data.map((d, i) => {
      const label = barXAccessor(d);
      const bandY = barScale(label) ?? 0;
      const y = bandY + margin.top;
      return { label, y, bandHeight: bandWidth, index: i };
    });
    if (showAllLabels || allLabels.length <= maxLabels) {
      return allLabels;
    }
    const step = Math.ceil(allLabels.length / maxLabels);
    return allLabels.filter((_, i) => i % step === 0);
  }, [
    barScale,
    bandWidth,
    barXAccessor,
    data,
    margin.top,
    showAllLabels,
    maxLabels
  ]);
  return createPortal(
    <div
      className="pointer-events-none absolute top-0 bottom-0"
      style={{
        left: 0,
        width: margin.left
      }}
    >{labelsToShow.map((item) => <BarYAxisLabel
      bandHeight={item.bandHeight}
      isHovered={hoveredBarIndex === item.index}
      key={`${item.label}-${item.y}`}
      label={item.label}
      labelMaxWidth={labelMaxWidth}
      y={item.y}
    />)}</div>,
    container
  );
});
BarYAxis.displayName = "BarYAxis";
var bar_y_axis_default = BarYAxis;
export {
  BarYAxis,
  bar_y_axis_default as default
};
