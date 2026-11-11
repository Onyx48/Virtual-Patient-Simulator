function resolveFadeSides(fade) {
  if (fade === false) {
    return { left: false, right: false, any: false };
  }
  if (fade === "left") {
    return { left: true, right: false, any: true };
  }
  if (fade === "right") {
    return { left: false, right: true, any: true };
  }
  return { left: true, right: true, any: true };
}
function fadeGradientStops(sides) {
  return [
    { offset: "0%", opacity: sides.left ? 0 : 1 },
    { offset: "15%", opacity: 1 },
    { offset: "85%", opacity: 1 },
    { offset: "100%", opacity: sides.right ? 0 : 1 }
  ];
}
function viewportFadeGradientAttrs(innerWidth) {
  return {
    gradientUnits: "userSpaceOnUse",
    x1: 0,
    x2: innerWidth,
    y1: 0,
    y2: 0
  };
}
export {
  fadeGradientStops,
  resolveFadeSides,
  viewportFadeGradientAttrs
};
