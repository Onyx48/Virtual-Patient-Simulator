const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const DEFAULT_CHART_ENTER_TRANSITION = {
  type: "tween",
  duration: DEFAULT_ANIMATION_DURATION_MS / 1e3,
  ease: [0.85, 0, 0.15, 1]
};
function clipRevealTransition(enterTransition) {
  if (enterTransition?.type === "tween") {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease
    };
  }
  const duration = typeof enterTransition?.duration === "number" ? enterTransition.duration : DEFAULT_ANIMATION_DURATION_MS / 1e3;
  return {
    type: "tween",
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease
  };
}
export {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
  DEFAULT_CHART_ENTER_TRANSITION,
  clipRevealTransition
};
