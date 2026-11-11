import { line as d3Line } from "d3-shape";
function computeSeriesPathPoints(data, xAccessor, xScale, yScale, dataKey) {
  const points = [];
  data.forEach((datum, index) => {
    const yValue = datum[dataKey];
    if (typeof yValue !== "number") {
      return;
    }
    const xValue = xAccessor(datum);
    points.push({
      x: xScale(xValue) ?? 0,
      y: yScale(yValue) ?? 0,
      key: String(xValue.getTime?.() ?? index)
    });
  });
  return points;
}
function interpolateSeriesPathPoints(from, to, progress) {
  if (progress >= 1) {
    return to;
  }
  if (progress <= 0) {
    return from.length > 0 ? from : to;
  }
  const fromByKey = new Map(from.map((point) => [point.key, point]));
  return to.map((target, index) => {
    const source = fromByKey.get(target.key);
    if (source) {
      return {
        key: target.key,
        x: source.x + (target.x - source.x) * progress,
        y: source.y + (target.y - source.y) * progress
      };
    }
    const previousTarget = index > 0 ? to[index - 1] : void 0;
    const previousSource = previousTarget ? fromByKey.get(previousTarget.key) : void 0;
    const nextTarget = index < to.length - 1 ? to[index + 1] : void 0;
    const nextSource = nextTarget ? fromByKey.get(nextTarget.key) : void 0;
    const anchor = previousSource ?? nextSource ?? from[0] ?? target;
    return {
      key: target.key,
      x: anchor.x + (target.x - anchor.x) * progress,
      y: anchor.y + (target.y - anchor.y) * progress
    };
  });
}
function seriesPathFromPoints(points, curve) {
  if (points.length === 0) {
    return "";
  }
  const generator = d3Line().x((point) => point.x).y((point) => point.y).curve(curve);
  return generator(points) ?? "";
}
function seriesPathTransitionSignature({
  renderData,
  xAccessor,
  dataKey,
  innerWidth,
  xDomainMin,
  xDomainMax
}) {
  const values = renderData.map((datum) => {
    const xValue = xAccessor(datum);
    const yValue = datum[dataKey];
    return `${xValue.getTime()}:${typeof yValue === "number" ? yValue : ""}`;
  });
  return `${innerWidth}|${xDomainMin}|${xDomainMax}|${values.join(",")}`;
}
export {
  computeSeriesPathPoints,
  interpolateSeriesPathPoints,
  seriesPathFromPoints,
  seriesPathTransitionSignature
};
