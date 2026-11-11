import {
  Children,
  cloneElement,
  Fragment,
  isValidElement
} from "react";
const CHART_CLIP_PASSTHROUGH = "__chartClipPassthrough";
function isChartClipPassthrough(type) {
  return typeof type === "function" && type[CHART_CLIP_PASSTHROUGH] === true;
}
function resolveChartChildElement(child) {
  if (isChartClipPassthrough(child.type)) {
    const inner = child.props.children;
    if (isValidElement(inner)) {
      return resolveChartChildElement(inner);
    }
  }
  return child;
}
function forEachChartChild(children, callback) {
  let index = 0;
  const visit = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit(child.props.children);
        return;
      }
      callback(child, index);
      index += 1;
    });
  };
  visit(children);
}
const CLIP_EXCLUDED_COMPONENT_NAMES = /* @__PURE__ */ new Set([
  "Background",
  "Grid",
  "XAxis",
  "YAxis",
  "BarXAxis",
  "BarYAxis",
  "LiveXAxis",
  "LiveYAxis"
]);
const UNDERLAY_COMPONENT_NAMES = /* @__PURE__ */ new Set(["ReferenceArea", "BarColumnTrack"]);
function isPostOverlayComponent(child) {
  const childType = child.type;
  if (childType.__isChartMarkers || childType.__isPostOverlay) {
    return true;
  }
  const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return componentName === "ChartMarkers" || componentName === "MarkerGroup" || componentName === "ChartBrush";
}
function isUnderlayComponent(child) {
  const childType = child.type;
  const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return UNDERLAY_COMPONENT_NAMES.has(componentName);
}
function isClipExcludedComponent(child) {
  const childType = child.type;
  const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName);
}
function renderKeyedChartLayers(children) {
  return children.map(
    (child, index) => cloneElement(child, { key: child.key ?? `chart-layer-${index}` })
  );
}
export {
  CHART_CLIP_PASSTHROUGH,
  forEachChartChild,
  isChartClipPassthrough,
  isClipExcludedComponent,
  isPostOverlayComponent,
  isUnderlayComponent,
  renderKeyedChartLayers,
  resolveChartChildElement
};
