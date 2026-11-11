const DEFAULT_CHART_STATUS = "ready";
const DEFAULT_Y_DOMAIN_TWEEN_MS = 500;
const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02;
function resolveRestingChartPhase(status) {
  return status === "loading" ? "loading" : "ready";
}
function isChartInteractionPhase(phase) {
  return phase === "ready";
}
const DEFAULT_CHART_LIFECYCLE = {
  chartPhase: "ready",
  chartStatus: "ready",
  loadingLabel: void 0,
  yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
  yDomainSkeletonByAxis: { left: [0, 100] },
  yDomainTargetByAxis: { left: [0, 100] }
};
export {
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  Y_DOMAIN_TWEEN_SKIP_THRESHOLD,
  isChartInteractionPhase,
  resolveRestingChartPhase
};
