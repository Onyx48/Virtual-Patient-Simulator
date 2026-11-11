const Y_AXIS_DEFAULT_TICK_COUNT = 5;
const Y_AXIS_MIN_TICK_COUNT = 1;
const Y_AXIS_MAX_TICK_COUNT = 10;
function resolveYAxisTickCount(numTicks) {
  if (numTicks == null || !Number.isFinite(numTicks)) {
    return Y_AXIS_DEFAULT_TICK_COUNT;
  }
  const rounded = Math.round(numTicks);
  if (rounded < Y_AXIS_MIN_TICK_COUNT) {
    return Y_AXIS_MIN_TICK_COUNT;
  }
  if (rounded > Y_AXIS_MAX_TICK_COUNT) {
    return Y_AXIS_MAX_TICK_COUNT;
  }
  return rounded;
}
export {
  Y_AXIS_DEFAULT_TICK_COUNT,
  Y_AXIS_MAX_TICK_COUNT,
  Y_AXIS_MIN_TICK_COUNT,
  resolveYAxisTickCount
};
