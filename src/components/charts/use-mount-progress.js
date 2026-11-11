import { animate, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
function useMountProgress(enterTransition, delaySeconds, replayKey) {
  const progress = useMotionValue(0);
  const transitionRef = useRef(enterTransition);
  transitionRef.current = enterTransition;
  useEffect(() => {
    progress.set(0);
    const controls = animate(progress, 1, {
      ...transitionRef.current ?? DEFAULT_CHART_ENTER_TRANSITION,
      delay: delaySeconds
    });
    return () => controls.stop();
  }, [delaySeconds, replayKey, progress]);
  return progress;
}
export {
  useMountProgress
};
