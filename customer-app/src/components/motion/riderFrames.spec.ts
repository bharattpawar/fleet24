import { riderCycle, riderFrameTrack } from './riderFrames';

/** Sample the same linear interpolation used by both RN's native driver and RN Web. */
function sample(track: ReturnType<typeof riderFrameTrack>, phase: number) {
  const i = track.inputRange.findIndex((end, index) => index > 0 && phase <= end);
  if (i < 0) return track.outputRange[track.outputRange.length - 1];
  const t = (phase - track.inputRange[i - 1]) / (track.inputRange[i] - track.inputRange[i - 1]);
  return track.outputRange[i - 1] + t * (track.outputRange[i] - track.outputRange[i - 1]);
}
describe('Rider atlas playback', () => {
  it('shows every complete pose, including each row boundary, without sliding between cells', () => {
    const x = riderFrameTrack('x', 320), y = riderFrameTrack('y', 320);
    for (let frame = 0; frame < riderCycle.frames; frame++) {
      const phase = (frame + 0.5) / riderCycle.frames;
      expect(sample(x, phase)).toBeCloseTo(-(frame % riderCycle.columns) * 320);
      expect(sample(y, phase)).toBeCloseTo(-Math.floor(frame / riderCycle.columns) * 320);
    }
  });
  it('returns to frame zero at the seamless loop boundary', () => {
    expect(sample(riderFrameTrack('x', 360), 1)).toBe(0);
    expect(sample(riderFrameTrack('y', 360), 1)).toBe(0);
    expect(riderCycle.frames).toBe(riderCycle.columns * riderCycle.rows);
  });
});
