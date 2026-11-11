import { scaleLinear } from "@visx/scale";
const DEFAULT_Y_AXIS_ID = "left";
function normalizeYAxisId(id) {
  if (id == null || id === "") {
    return DEFAULT_Y_AXIS_ID;
  }
  return String(id);
}
function groupLinesByYAxisId(lines) {
  const groups = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const axisId = normalizeYAxisId(line.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(line);
    groups.set(axisId, bucket);
  }
  return groups;
}
function getPrimaryYScale(yScales, fallback) {
  const primary = yScales[DEFAULT_Y_AXIS_ID];
  if (primary) {
    return primary;
  }
  const first = Object.values(yScales)[0];
  return first ?? fallback;
}
function buildYScalesForLines({
  lines,
  innerHeight,
  resolveDomain
}) {
  const groups = groupLinesByYAxisId(lines);
  const scales = {};
  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    const domain = resolveDomain(dataKeys);
    scales[axisId] = scaleLinear({
      range: [innerHeight, 0],
      domain,
      nice: true
    });
  }
  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, 100],
      nice: true
    });
  }
  return scales;
}
function buildYScalesFromDomains({
  lines,
  innerHeight,
  domainsByAxis
}) {
  const groups = groupLinesByYAxisId(lines);
  const scales = {};
  for (const [axisId] of groups) {
    const domain = domainsByAxis[axisId] ?? domainsByAxis[DEFAULT_Y_AXIS_ID] ?? [0, 100];
    scales[axisId] = scaleLinear({
      range: [innerHeight, 0],
      domain
    });
  }
  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = scaleLinear({
      range: [innerHeight, 0],
      domain: domainsByAxis[DEFAULT_Y_AXIS_ID] ?? [0, 100]
    });
  }
  return scales;
}
function wrapSingleYScale(yScale) {
  return { [DEFAULT_Y_AXIS_ID]: yScale };
}
export {
  DEFAULT_Y_AXIS_ID,
  buildYScalesForLines,
  buildYScalesFromDomains,
  getPrimaryYScale,
  groupLinesByYAxisId,
  normalizeYAxisId,
  wrapSingleYScale
};
