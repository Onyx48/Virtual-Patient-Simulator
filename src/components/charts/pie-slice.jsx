import { arc as arcGenerator } from "@visx/shape";
import { motion, useSpring, useTransform } from "motion/react";
import { memo, useEffect } from "react";
import { usePieHover, usePieStable } from "./pie-context";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";
function generateArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius, padAngle) {
  const generator = arcGenerator({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle
  });
  return generator({ startAngle, endAngle }) || "";
}
function getSliceOffset(startAngle, endAngle, distance) {
  const midAngle = (startAngle + endAngle) / 2;
  return {
    x: Math.sin(midAngle) * distance,
    y: -Math.cos(midAngle) * distance
  };
}
function AnimatedSliceTranslate({
  index,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  cornerRadius,
  padAngle,
  fill,
  color,
  isHovered,
  isFaded,
  animationKey,
  showGlow,
  hoverOffset
}) {
  const {
    enterTransition,
    enterStaggerScale,
    animationKey: pieAnimationKey
  } = usePieStable();
  const animationDelay = (0.1 + index * 0.08) * enterStaggerScale;
  const mountProgress = useMountProgress(
    enterTransition,
    animationDelay,
    pieAnimationKey
  );
  const enterComplete = useEnterComplete(mountProgress);
  const animatedPath = useTransform(mountProgress, (mount) => {
    const currentEndAngle = startAngle + (endAngle - startAngle) * mount;
    if (currentEndAngle <= startAngle + 0.01) {
      return "";
    }
    return generateArcPath(
      innerRadius,
      outerRadius,
      startAngle,
      currentEndAngle,
      cornerRadius,
      padAngle
    );
  });
  const offset = getSliceOffset(startAngle, endAngle, hoverOffset);
  const glowColor = color;
  const hitboxPath = generateArcPath(
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle
  );
  if (enterComplete) {
    const shouldTranslate = isHovered;
    return <motion.path
      animate={{
        opacity: isFaded ? 0.4 : 1,
        x: shouldTranslate ? offset.x : 0,
        y: shouldTranslate ? offset.y : 0
      }}
      d={hitboxPath}
      fill={fill}
      pointerEvents="none"
      style={{
        filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none"
      }}
      transition={{
        opacity: { duration: 0.15 },
        x: { type: "spring", stiffness: 400, damping: 25 },
        y: { type: "spring", stiffness: 400, damping: 25 }
      }}
    />;
  }
  return <motion.path
    animate={{
      opacity: isFaded ? 0.4 : 1,
      x: isHovered ? offset.x : 0,
      y: isHovered ? offset.y : 0
    }}
    d={animatedPath}
    fill={fill}
    key={`slice-${animationKey}-${index}`}
    pointerEvents="none"
    style={{
      filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none"
    }}
    transition={{
      opacity: { duration: 0.15 },
      x: { type: "spring", stiffness: 400, damping: 25 },
      y: { type: "spring", stiffness: 400, damping: 25 }
    }}
  />;
}
function AnimatedSliceGrow({
  index,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  cornerRadius,
  padAngle,
  fill,
  color,
  isHovered,
  isFaded,
  animationKey,
  showGlow,
  hoverOffset
}) {
  const {
    enterTransition,
    enterStaggerScale,
    animationKey: pieAnimationKey
  } = usePieStable();
  const animationDelay = (0.1 + index * 0.08) * enterStaggerScale;
  const mountProgress = useMountProgress(
    enterTransition,
    animationDelay,
    pieAnimationKey
  );
  const enterComplete = useEnterComplete(mountProgress);
  const growSpring = useSpring(outerRadius, {
    stiffness: 400,
    damping: 25
  });
  useEffect(() => {
    growSpring.set(isHovered ? outerRadius + hoverOffset : outerRadius);
  }, [isHovered, hoverOffset, outerRadius, growSpring]);
  const animatedPath = useTransform(
    [mountProgress, growSpring],
    ([mount, currentOuterRadius]) => {
      const currentEndAngle = startAngle + (endAngle - startAngle) * mount;
      if (currentEndAngle <= startAngle + 0.01) {
        return "";
      }
      return generateArcPath(
        innerRadius,
        currentOuterRadius,
        startAngle,
        currentEndAngle,
        cornerRadius,
        padAngle
      );
    }
  );
  const glowColor = color;
  const grownOuterRadius = isHovered ? outerRadius + hoverOffset : outerRadius;
  const grownPath = generateArcPath(
    innerRadius,
    grownOuterRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle
  );
  if (enterComplete) {
    return <motion.path
      animate={{
        opacity: isFaded ? 0.4 : 1,
        d: grownPath
      }}
      d={grownPath}
      fill={fill}
      pointerEvents="none"
      style={{
        filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none"
      }}
      transition={{
        opacity: { duration: 0.15 },
        d: { type: "spring", stiffness: 400, damping: 25 }
      }}
    />;
  }
  return <motion.path
    animate={{
      opacity: isFaded ? 0.4 : 1
    }}
    d={animatedPath}
    fill={fill}
    key={`slice-${animationKey}-${index}`}
    pointerEvents="none"
    style={{
      filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none"
    }}
    transition={{
      opacity: { duration: 0.15 }
    }}
  />;
}
const PieSlice = memo(function PieSlice2({
  index,
  color: colorProp,
  fill: fillProp,
  animate = true,
  showGlow = true,
  hoverEffect = "translate",
  hoverOffset: hoverOffsetProp
}) {
  const {
    arcs,
    innerRadius,
    outerRadius,
    cornerRadius,
    hoverOffset: contextHoverOffset,
    animationKey,
    geometryScrubbing,
    scrubSlicePaths,
    getColor,
    getFill
  } = usePieStable();
  const { hoveredIndex, setHoveredIndex } = usePieHover();
  const hoverOffset = hoverOffsetProp ?? contextHoverOffset;
  const arcData = arcs[index];
  if (!arcData) {
    return null;
  }
  const color = colorProp || getColor(index);
  const fill = fillProp || getFill(index);
  if (geometryScrubbing) {
    const scrubPath = scrubSlicePaths?.[index];
    if (!scrubPath) {
      return null;
    }
    return <path d={scrubPath} fill={fill} pointerEvents="none" />;
  }
  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  const offset = getSliceOffset(
    arcData.startAngle,
    arcData.endAngle,
    hoverOffset
  );
  const hitboxPath = generateArcPath(
    innerRadius,
    outerRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle
  );
  const grownOuterRadius = isHovered ? outerRadius + hoverOffset : outerRadius;
  const grownPath = generateArcPath(
    innerRadius,
    grownOuterRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle
  );
  const renderAnimatedSlice = () => {
    if (hoverEffect === "grow") {
      return <AnimatedSliceGrow
        animationKey={animationKey}
        color={color}
        cornerRadius={cornerRadius}
        endAngle={arcData.endAngle}
        fill={fill}
        hoverOffset={hoverOffset}
        index={index}
        innerRadius={innerRadius}
        isFaded={isFaded}
        isHovered={isHovered}
        outerRadius={outerRadius}
        padAngle={arcData.padAngle}
        showGlow={showGlow}
        startAngle={arcData.startAngle}
      />;
    }
    return <AnimatedSliceTranslate
      animationKey={animationKey}
      color={color}
      cornerRadius={cornerRadius}
      endAngle={arcData.endAngle}
      fill={fill}
      hoverOffset={hoverEffect === "none" ? 0 : hoverOffset}
      index={index}
      innerRadius={innerRadius}
      isFaded={isFaded}
      isHovered={isHovered}
      outerRadius={outerRadius}
      padAngle={arcData.padAngle}
      showGlow={showGlow}
      startAngle={arcData.startAngle}
    />;
  };
  const renderStaticSlice = () => {
    if (hoverEffect === "grow") {
      return <motion.path
        animate={{
          opacity: isFaded ? 0.4 : 1,
          d: grownPath
        }}
        d={hitboxPath}
        fill={fill}
        pointerEvents="none"
        style={{
          filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none"
        }}
        transition={{
          opacity: { duration: 0.15 },
          d: { type: "spring", stiffness: 400, damping: 25 }
        }}
      />;
    }
    const shouldTranslate = hoverEffect !== "none" && isHovered;
    const translateX = shouldTranslate ? offset.x : 0;
    const translateY = shouldTranslate ? offset.y : 0;
    return <motion.path
      animate={{
        opacity: isFaded ? 0.4 : 1,
        x: translateX,
        y: translateY
      }}
      d={hitboxPath}
      fill={fill}
      pointerEvents="none"
      style={{
        filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none"
      }}
      transition={{
        opacity: { duration: 0.15 },
        x: { type: "spring", stiffness: 400, damping: 25 },
        y: { type: "spring", stiffness: 400, damping: 25 }
      }}
    />;
  };
  return <g style={{ cursor: "pointer" }}>{
    /* Invisible hitbox - stays in place, handles hover events */
  }{
    /* biome-ignore lint/a11y/noStaticElementInteractions: SVG path used as hover hitbox for visualization */
  }<path
    d={hitboxPath}
    fill="transparent"
    onMouseEnter={() => setHoveredIndex(index)}
    onMouseLeave={() => setHoveredIndex(null)}
  />{
    /* Visible slice - animates based on hover effect, no pointer events */
  }{animate ? renderAnimatedSlice() : renderStaticSlice()}</g>;
});
PieSlice.displayName = "PieSlice";
var pie_slice_default = PieSlice;
export {
  PieSlice,
  pie_slice_default as default
};
