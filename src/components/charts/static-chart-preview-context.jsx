import { createContext, useContext } from "react";
const StaticChartPreviewContext = createContext(false);
function StaticChartPreviewProvider({
  children
}) {
  return <StaticChartPreviewContext.Provider value={true}>{children}</StaticChartPreviewContext.Provider>;
}
function useStaticChartPreview() {
  return useContext(StaticChartPreviewContext);
}
export {
  StaticChartPreviewProvider,
  useStaticChartPreview
};
