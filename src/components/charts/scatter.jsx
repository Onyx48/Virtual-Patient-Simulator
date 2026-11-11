import { useId } from "react";
import { useChartStable } from "./chart-context";
import { SeriesMarkers } from "./series-markers";
const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-success)";
function Scatter({
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
  showActiveHighlight = true,
  yGradient
}) {
  const { innerHeight } = useChartStable();
  const yGradientConfig = (() => {
    if (!yGradient) {
      return null;
    }
    if (yGradient === true) {
      return { from: DEFAULT_Y_GRADIENT_FROM, to: DEFAULT_Y_GRADIENT_TO };
    }
    return {
      from: yGradient.from ?? DEFAULT_Y_GRADIENT_FROM,
      to: yGradient.to ?? DEFAULT_Y_GRADIENT_TO
    };
  })();
  const yGradientId = `scatter-y-gradient-${useId().replace(/:/g, "")}`;
  const gradientFill = yGradientConfig ? `url(#${yGradientId})` : void 0;
  const resolvedFill = gradientFill ?? fill;
  const resolvedStroke = stroke ?? (gradientFill ? gradientFill : void 0);
  return <>{yGradientConfig ? <defs><linearGradient
    gradientUnits="userSpaceOnUse"
    id={yGradientId}
    x1={0}
    x2={0}
    y1={innerHeight}
    y2={0}
  ><stop offset="0%" stopColor={yGradientConfig.from} /><stop offset="100%" stopColor={yGradientConfig.to} /></linearGradient></defs> : null}<SeriesMarkers
    animate={animate}
    dataKey={dataKey}
    enterBlur={enterBlur}
    fadeOnHover={fadeOnHover}
    fill={resolvedFill}
    inactiveBlur={inactiveBlur}
    inactiveOpacity={inactiveOpacity}
    outlineColor={outlineColor}
    outlineWidth={outlineWidth}
    radius={radius}
    ringGap={ringGap}
    showActiveHighlight={showActiveHighlight}
    stroke={resolvedStroke}
    strokeWidth={strokeWidth}
  /></>;
}
Scatter.displayName = "Scatter";
var scatter_default = Scatter;
export {
  Scatter,
  scatter_default as default
};
