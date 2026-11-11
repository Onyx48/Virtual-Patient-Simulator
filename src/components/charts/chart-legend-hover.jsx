import { createContext, useContext, useMemo } from "react";
const ChartLegendHoverContext = createContext(null);
function ChartLegendHoverProvider({
  hoveredIndex,
  onHoverChange,
  children
}) {
  const value = useMemo(
    () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
    [hoveredIndex, onHoverChange]
  );
  return <ChartLegendHoverContext.Provider value={value}>{children}</ChartLegendHoverContext.Provider>;
}
function useChartLegendHover() {
  const context = useContext(ChartLegendHoverContext);
  return context ?? {
    hoveredIndex: null,
    setHoveredIndex: () => {
    }
  };
}
export {
  ChartLegendHoverProvider,
  useChartLegendHover
};
