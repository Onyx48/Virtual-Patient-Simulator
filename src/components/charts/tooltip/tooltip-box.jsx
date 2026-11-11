import { motion, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";
function TooltipBox(props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!props.visible) {
    return null;
  }
  return <TooltipBoxInner {...props} container={container} />;
}
function placeTooltipX(x, width, offset, containerWidth) {
  const right = x + offset;
  if (right + width <= containerWidth) {
    return right;
  }
  const left = x - offset - width;
  if (left >= 0) {
    return left;
  }
  return x > containerWidth / 2 ? 0 : Math.min(right, Math.max(0, containerWidth - width));
}
function TooltipBoxInner({
  x,
  y,
  containerWidth,
  containerHeight,
  offset = 16,
  className = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride,
  springConfig,
  animate = true,
  entrance = true,
  panelStyle,
  backgroundColor = chartCssVars.tooltipBackground,
  container
}) {
  const { tooltipBoxSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipBoxSpring;
  const tooltipRef = useRef(null);
  const tooltipWidthRef = useRef(180);
  const tooltipHeightRef = useRef(80);
  const [staticPosition, setStaticPosition] = useState({ left: x, top: y });
  const tw = tooltipWidthRef.current;
  const th = tooltipHeightRef.current;
  const shouldFlipX = x + tw + offset > containerWidth;
  const targetX = placeTooltipX(x, tw, offset, containerWidth);
  const targetY = Math.max(
    offset,
    Math.min(y - th / 2, containerHeight - th - offset)
  );
  const animatedLeft = useSpring(targetX, effectiveSpring);
  const animatedTop = useSpring(targetY, effectiveSpring);
  if (animate && leftOverride === void 0) {
    animatedLeft.set(targetX);
  }
  if (animate && topOverride === void 0) {
    animatedTop.set(targetY);
  }
  useLayoutEffect(() => {
    if (!tooltipRef.current) {
      return;
    }
    const el = tooltipRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0) {
      tooltipWidthRef.current = w;
    }
    if (h > 0) {
      tooltipHeightRef.current = h;
    }
    const w2 = tooltipWidthRef.current;
    const h2 = tooltipHeightRef.current;
    const tx = placeTooltipX(x, w2, offset, containerWidth);
    const ty = Math.max(
      offset,
      Math.min(y - h2 / 2, containerHeight - h2 - offset)
    );
    if (!animate) {
      setStaticPosition({ left: tx, top: ty });
      return;
    }
    if (leftOverride === void 0) {
      animatedLeft.set(tx);
    }
    if (topOverride === void 0) {
      animatedTop.set(ty);
    }
  }, [
    x,
    y,
    containerWidth,
    containerHeight,
    offset,
    leftOverride,
    topOverride,
    animate,
    animatedLeft,
    animatedTop
  ]);
  const prevFlipRef = useRef(shouldFlipX);
  const [flipKey, setFlipKey] = useState(0);
  useEffect(() => {
    if (prevFlipRef.current !== shouldFlipX) {
      setFlipKey((k) => k + 1);
      prevFlipRef.current = shouldFlipX;
    }
  }, [shouldFlipX]);
  const finalLeft = animate ? leftOverride ?? animatedLeft : staticPosition.left;
  const finalTop = animate ? topOverride ?? animatedTop : staticPosition.top;
  const isFlipped = flippedOverride ?? shouldFlipX;
  const transformOrigin = isFlipped ? "right top" : "left top";
  const panelClassName = cn(
    "min-w-[140px] overflow-hidden rounded-lg text-chart-tooltip-foreground shadow-sm",
    panelStyle?.backgroundColor === void 0 && backgroundColor === chartCssVars.tooltipBackground && "bg-chart-tooltip-background",
    panelStyle?.backdropFilter === void 0 && ""
  );
  const panelStyleResolved = {
    transformOrigin,
    ...panelStyle?.backgroundColor === void 0 && {
      backgroundColor
    },
    ...panelStyle
  };
  if (!entrance) {
    return createPortal(
      <div
        className={cn("pointer-events-none absolute z-50", className)}
        ref={tooltipRef}
        style={{ left: staticPosition.left, top: staticPosition.top }}
      ><div className={panelClassName} style={panelStyleResolved}>{children}</div></div>,
      container
    );
  }
  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className={cn("pointer-events-none absolute z-50", className)}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      ref={tooltipRef}
      style={{ left: finalLeft, top: finalTop }}
      transition={{ duration: 0.1 }}
    ><motion.div
      animate={{ scale: 1, opacity: 1, x: 0 }}
      className={panelClassName}
      initial={{ scale: 0.85, opacity: 0, x: isFlipped ? 20 : -20 }}
      key={flipKey}
      style={panelStyleResolved}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >{children}</motion.div></motion.div>,
    container
  );
}
TooltipBox.displayName = "TooltipBox";
var tooltip_box_default = TooltipBox;
export {
  TooltipBox,
  tooltip_box_default as default
};
