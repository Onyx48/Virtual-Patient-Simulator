import { scaleLinear } from "@visx/scale";
import { Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from "./chart-phase";
import { groupLinesByYAxisId, normalizeYAxisId } from "./y-axis-scales";
function niceYDomain(domain) {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true });
  const niceDomain = scale.domain();
  return [niceDomain[0] ?? domain[0], niceDomain[1] ?? domain[1]];
}
function shouldTweenYDomain(from, to) {
  const span = Math.max(
    Math.abs(to[1] - to[0]),
    Math.abs(from[1] - from[0]),
    1
  );
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD || deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD;
}
function isLoadingChromePhase(phase) {
  return phase === "loading" || phase === "revealingLoading";
}
function isLoadingGridChromePhase(phase) {
  return phase === "loading" || phase === "exiting" || phase === "gridTweenLoading";
}
function isYDomainTweenPhase(phase) {
  return phase === "gridTweenLoading" || phase === "gridTweenReady";
}
function isReferenceAreaVisiblePhase(phase) {
  return phase === "ready" || phase === "revealing" || phase === "gridTweenReady";
}
function resolveAnimatedYDestinationDomains(chartPhase, skeletonByAxis, targetByAxis) {
  switch (chartPhase) {
    case "loading":
    case "exiting":
    case "gridTweenLoading":
      return skeletonByAxis;
    case "exitingReady":
    case "gridTweenReady":
    case "revealing":
    case "ready":
      return targetByAxis;
    default:
      return targetByAxis;
  }
}
function computeYDomainsByAxis({
  lines,
  resolveDomain
}) {
  const groups = groupLinesByYAxisId(lines);
  const domains = {};
  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    domains[normalizeYAxisId(axisId)] = niceYDomain(resolveDomain(dataKeys));
  }
  if (!domains.left) {
    domains.left = niceYDomain([0, 100]);
  }
  return domains;
}
function mergeYDomainRecords(...records) {
  const merged = {};
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain;
    }
  }
  return merged;
}
function domainsEqual(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const axisId of leftKeys) {
    const from = left[axisId];
    const to = right[axisId];
    if (!(from && to) || from[0] !== to[0] || from[1] !== to[1]) {
      return false;
    }
  }
  return true;
}
export {
  computeYDomainsByAxis,
  domainsEqual,
  isLoadingChromePhase,
  isLoadingGridChromePhase,
  isReferenceAreaVisiblePhase,
  isYDomainTweenPhase,
  mergeYDomainRecords,
  niceYDomain,
  resolveAnimatedYDestinationDomains,
  shouldTweenYDomain
};
