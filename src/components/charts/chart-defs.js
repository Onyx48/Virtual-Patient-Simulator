import {
  Children,
  isValidElement
} from "react";
function getChartChildComponentName(child) {
  const childType = child.type;
  return typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
}
const VISX_PATTERN_COMPONENT_NAMES = /* @__PURE__ */ new Set([
  "Lines",
  "Circles",
  "Waves",
  "Hexagons",
  "Path",
  "Pattern"
]);
function isPatternDefComponent(child) {
  const name = getChartChildComponentName(child);
  return name.includes("Pattern") || VISX_PATTERN_COMPONENT_NAMES.has(name);
}
function isGradientDefComponent(child) {
  const name = getChartChildComponentName(child);
  return name.includes("Gradient") || name === "LinearGradient" || name === "RadialGradient";
}
function isChartDefsComponent(child) {
  return isPatternDefComponent(child) || isGradientDefComponent(child);
}
function partitionChartDefNodes(defNodes) {
  const patternDefNodes = [];
  const gradientDefNodes = [];
  for (const node of defNodes) {
    if (isPatternDefComponent(node)) {
      patternDefNodes.push(node);
    } else {
      gradientDefNodes.push(node);
    }
  }
  return { patternDefNodes, gradientDefNodes };
}
function collectChartDefsChildren(children) {
  const defNodes = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && isChartDefsComponent(child)) {
      defNodes.push(child);
    }
  });
  return defNodes;
}
export {
  collectChartDefsChildren,
  getChartChildComponentName,
  isChartDefsComponent,
  isGradientDefComponent,
  isPatternDefComponent,
  partitionChartDefNodes
};
