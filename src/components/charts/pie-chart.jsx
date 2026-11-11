import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { CHART_RESIZE_DEBOUNCE_MS } from "./chart-context";
import { arc as arcGenerator } from "@visx/shape";
import { pie as d3Pie } from "d3-shape";
import {
  Children,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { cn } from "@/lib/utils";
import {
  defaultPieColors,
  PieProvider
} from "./pie-context";
const DEFAULT_HOVER_OFFSET = 10;
function generatePieArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius, padAngle) {
  const generator = arcGenerator({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle
  });
  return generator({ startAngle, endAngle }) || "";
}
function isPieCenter(child) {
  return isValidElement(child) && typeof child.type === "function" && (child.type.displayName === "PieCenter" || child.type.name === "PieCenter");
}
function isPieSlice(child) {
  return isValidElement(child) && typeof child.type === "function" && (child.type.displayName === "PieSlice" || child.type.name === "PieSlice");
}
function isDefsComponent(child) {
  const displayName = child.type?.displayName || child.type?.name || "";
  return displayName.includes("Gradient") || displayName.includes("Pattern") || displayName === "LinearGradient" || displayName === "RadialGradient";
}
function PieChartInner(props) {
  const size = Math.min(props.width, props.height);
  if (size < 10) {
    return null;
  }
  return <PieChartCore {...props} />;
}
const PieChartCore = memo(function PieChartCore2({
  width,
  height,
  data,
  innerRadius: innerRadiusProp,
  padAngle,
  cornerRadius,
  startAngle,
  endAngle,
  hoverOffset,
  children,
  containerRef,
  hoveredIndexProp,
  onHoverChange,
  enterTransition,
  enterStaggerScale,
  geometryScrubbing
}) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState(null);
  const [animationKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const isControlled = hoveredIndexProp !== void 0;
  const hoveredIndex = isControlled ? hoveredIndexProp : internalHoveredIndex;
  const setHoveredIndex = useCallback(
    (index) => {
      if (isControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isControlled, onHoverChange]
  );
  const size = Math.min(width, height);
  const center = size / 2;
  const padding = hoverOffset;
  const outerRadius = center - padding;
  const innerRadius = innerRadiusProp;
  const totalValue = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data]
  );
  const getColor = useCallback(
    (index) => {
      const item = data[index];
      if (item?.color) {
        return item.color;
      }
      return defaultPieColors[index % defaultPieColors.length];
    },
    [data]
  );
  const getFill = useCallback(
    (index) => {
      const item = data[index];
      if (item?.fill) {
        return item.fill;
      }
      return getColor(index);
    },
    [data, getColor]
  );
  const arcs = useMemo(() => {
    const pieGenerator = d3Pie().value((d) => d.value).startAngle(startAngle).endAngle(endAngle).padAngle(padAngle).sort(null);
    const computed = pieGenerator(data);
    return computed.map((arc, index) => ({
      data: arc.data,
      index,
      startAngle: arc.startAngle,
      endAngle: arc.endAngle,
      padAngle: arc.padAngle,
      value: arc.value
    }));
  }, [data, startAngle, endAngle, padAngle]);
  const scrubSlicePaths = useMemo(() => {
    if (!geometryScrubbing) {
      return null;
    }
    return arcs.map(
      (arc) => generatePieArcPath(
        innerRadius,
        outerRadius,
        arc.startAngle,
        arc.endAngle,
        cornerRadius,
        arc.padAngle
      )
    );
  }, [geometryScrubbing, arcs, innerRadius, outerRadius, cornerRadius]);
  const effectiveIsLoaded = geometryScrubbing || isLoaded;
  useEffect(() => {
    if (geometryScrubbing) {
      return;
    }
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [enterTransition, enterStaggerScale, geometryScrubbing]);
  const { svgChildren, centerChildren, defsChildren } = useMemo(() => {
    const svgNodes = [];
    const centerNodes = [];
    const defsNodes = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        svgNodes.push(child);
        return;
      }
      if (isPieCenter(child)) {
        centerNodes.push(child);
      } else if (isDefsComponent(child)) {
        defsNodes.push(child);
      } else if (geometryScrubbing && isPieSlice(child)) {
        return;
      } else {
        svgNodes.push(child);
      }
    });
    return {
      svgChildren: svgNodes,
      centerChildren: centerNodes,
      defsChildren: defsNodes
    };
  }, [children, geometryScrubbing]);
  const scrubSliceFills = useMemo(() => {
    if (!(geometryScrubbing && scrubSlicePaths)) {
      return null;
    }
    return scrubSlicePaths.map((_, index) => getFill(index));
  }, [geometryScrubbing, scrubSlicePaths, getFill]);
  const contextValue = useMemo(
    () => ({
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      isLoaded: effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths
    }),
    [
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths
    ]
  );
  return <PieProvider value={contextValue}><div
    className="grid"
    style={{
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr",
      width: size,
      height: size
    }}
  >{
    /* SVG layer with pie slices */
  }<svg
    aria-hidden="true"
    height={size}
    style={{ gridArea: "1 / 1", contain: "layout style paint" }}
    width={size}
  >{
    /* Defs for patterns and gradients */
  }{defsChildren.length > 0 && <defs>{defsChildren}</defs>}<Group left={center} top={center}>{scrubSlicePaths && scrubSliceFills ? scrubSlicePaths.map(
    (d, index) => d ? <path
      d={d}
      fill={scrubSliceFills[index]}
      key={data[index]?.label ?? index}
      pointerEvents="none"
    /> : null
  ) : null}{svgChildren}</Group></svg>{
    /* HTML layer with center content - stacked on top via grid */
  }{centerChildren.length > 0 && <div
    className="pointer-events-none flex items-center justify-center"
    style={{ gridArea: "1 / 1" }}
  >{centerChildren}</div>}</div></PieProvider>;
}, pieChartCorePropsEqual);
function pieChartCorePropsEqual(prev, next) {
  return prev.width === next.width && prev.height === next.height && prev.data === next.data && prev.innerRadius === next.innerRadius && prev.padAngle === next.padAngle && prev.cornerRadius === next.cornerRadius && prev.startAngle === next.startAngle && prev.endAngle === next.endAngle && prev.hoverOffset === next.hoverOffset && prev.hoveredIndexProp === next.hoveredIndexProp && prev.onHoverChange === next.onHoverChange && prev.enterTransition === next.enterTransition && prev.enterStaggerScale === next.enterStaggerScale && prev.geometryScrubbing === next.geometryScrubbing && prev.children === next.children;
}
function PieChart({
  data,
  size: fixedSize,
  innerRadius = 0,
  padAngle = 0,
  cornerRadius = 0,
  startAngle = -Math.PI / 2,
  endAngle = 3 * Math.PI / 2,
  className = "",
  hoveredIndex,
  onHoverChange,
  hoverOffset = DEFAULT_HOVER_OFFSET,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children
}) {
  const containerRef = useRef(null);
  if (fixedSize) {
    return <div
      className={cn("relative flex items-center justify-center", className)}
      ref={containerRef}
      style={{ width: fixedSize, height: fixedSize }}
    ><PieChartInner
      containerRef={containerRef}
      cornerRadius={cornerRadius}
      data={data}
      endAngle={endAngle}
      enterStaggerScale={enterStaggerScale}
      enterTransition={enterTransition}
      geometryScrubbing={geometryScrubbing}
      height={fixedSize}
      hoveredIndexProp={hoveredIndex}
      hoverOffset={hoverOffset}
      innerRadius={innerRadius}
      onHoverChange={onHoverChange}
      padAngle={padAngle}
      startAngle={startAngle}
      width={fixedSize}
    >{children}</PieChartInner></div>;
  }
  return <div
    className={cn("relative aspect-square w-full", className)}
    ref={containerRef}
  ><ParentSize debounceTime={CHART_RESIZE_DEBOUNCE_MS}>{({ width, height }) => <PieChartInner
    containerRef={containerRef}
    cornerRadius={cornerRadius}
    data={data}
    endAngle={endAngle}
    enterStaggerScale={enterStaggerScale}
    enterTransition={enterTransition}
    geometryScrubbing={geometryScrubbing}
    height={height}
    hoveredIndexProp={hoveredIndex}
    hoverOffset={hoverOffset}
    innerRadius={innerRadius}
    onHoverChange={onHoverChange}
    padAngle={padAngle}
    startAngle={startAngle}
    width={width}
  >{children}</PieChartInner>}</ParentSize></div>;
}
PieChart.displayName = "PieChart";
var pie_chart_default = PieChart;
export {
  DEFAULT_HOVER_OFFSET,
  PieChart,
  pie_chart_default as default
};
