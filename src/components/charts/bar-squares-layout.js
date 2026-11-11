function computeSquareColumn({
  barLengthPx,
  squareSize,
  gap,
  fit = false
}) {
  if (barLengthPx <= 0 || squareSize <= 0) {
    return { count: 0, positions: [], columnHeight: 0, squareSize, gap };
  }
  if (fit) {
    const count2 = Math.max(
      1,
      Math.floor((barLengthPx + gap) / (squareSize + gap))
    );
    const effectiveGap = count2 > 1 ? Math.max(0, (barLengthPx - count2 * squareSize) / (count2 - 1)) : 0;
    const step2 = squareSize + effectiveGap;
    const columnHeight2 = barLengthPx;
    const positions2 = [];
    for (let i = 0; i < count2; i++) {
      positions2.push(columnHeight2 - squareSize - i * step2);
    }
    return {
      count: count2,
      positions: positions2,
      columnHeight: columnHeight2,
      squareSize,
      gap: effectiveGap
    };
  }
  const step = squareSize + gap;
  const count = Math.max(1, Math.round(barLengthPx / step));
  const columnHeight = count * squareSize + Math.max(0, count - 1) * gap;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const offsetFromBottom = i * step;
    positions.push(columnHeight - squareSize - offsetFromBottom);
  }
  return { count, positions, columnHeight, squareSize, gap };
}
function topSquareCenterY({
  baselineY,
  barLengthPx,
  squareSize,
  gap,
  fit = false
}) {
  const {
    count,
    squareSize: size,
    columnHeight
  } = computeSquareColumn({
    barLengthPx,
    squareSize,
    gap,
    fit
  });
  if (count === 0) {
    return baselineY;
  }
  const topY = baselineY - columnHeight;
  return topY + size / 2;
}
export {
  computeSquareColumn,
  topSquareCenterY
};
