import { useChartStable } from "./chart-context";
import { HighlightSegment } from "./highlight-segment";
import { useHighlightSegment } from "./use-highlight-segment";
function SeriesHighlightLayer({
  enabled,
  height,
  pathRef,
  stroke,
  strokeWidth
}) {
  const { isLoaded } = useChartStable();
  const { xSpring, widthSpring, isActive } = useHighlightSegment({ enabled });
  return <HighlightSegment
    height={height}
    pathRef={pathRef}
    stroke={stroke}
    strokeWidth={strokeWidth}
    visible={enabled && isActive && isLoaded}
    width={widthSpring}
    x={xSpring}
  />;
}
SeriesHighlightLayer.displayName = "SeriesHighlightLayer";
var series_highlight_layer_default = SeriesHighlightLayer;
export {
  SeriesHighlightLayer,
  series_highlight_layer_default as default
};
