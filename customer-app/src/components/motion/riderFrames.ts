import metadata from '../../../assets/illustrations/rider/rider-cycle.json';

export const riderCycle = metadata;

/** Constant frame holds, with sub-frame transitions; only transform nodes run during playback. */
export function riderFrameTrack(axis: 'x' | 'y', cellSize: number) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let frame = 0; frame < riderCycle.frames; frame++) {
    const cell = axis === 'x' ? frame % riderCycle.columns : Math.floor(frame / riderCycle.columns);
    inputRange.push(frame / riderCycle.frames, (frame + 1) / riderCycle.frames - 0.000001);
    outputRange.push(-cell * cellSize, -cell * cellSize);
  }
  inputRange.push(1); outputRange.push(0);
  return { inputRange, outputRange, extrapolate: 'clamp' as const };
}
