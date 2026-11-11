import { useEffect, useState } from "react";
function findPathLengthAtX(path, pathLength, targetX) {
  if (!path || pathLength === 0) {
    return 0;
  }
  let low = 0;
  let high = pathLength;
  const tolerance = 0.5;
  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const point = path.getPointAtLength(mid);
    if (point.x < targetX) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
const EMPTY_METRICS = { pathD: null, pathLength: 0 };
function usePathStrokeMetrics(pathRef, deps) {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) {
      return;
    }
    const d = path.getAttribute("d");
    const len = d ? path.getTotalLength() : 0;
    setMetrics(
      (prev) => prev.pathD === d && prev.pathLength === len ? prev : { pathD: d, pathLength: len }
    );
  }, deps);
  return metrics;
}
function resolveDashTailBounds(dashFromIndex, dataLength) {
  return dashFromIndex != null && dashFromIndex >= 0 && dashFromIndex < dataLength - 1;
}
function resolveDashStartX(data, dashFromIndex, xScale, xAccessor) {
  const dashFromPoint = data[dashFromIndex];
  if (!dashFromPoint) {
    return 0;
  }
  return xScale(xAccessor(dashFromPoint)) ?? 0;
}
export {
  findPathLengthAtX,
  resolveDashStartX,
  resolveDashTailBounds,
  usePathStrokeMetrics
};
