export interface CharacterAtlas { frames: number; columns: number; rows: number; durationMs: number }

/** Hold complete rendered poses; crossing a cell/row boundary takes less than one display frame. */
export function characterFrameTrack(atlas: CharacterAtlas, axis: 'x' | 'y', size: number) {
  const inputRange: number[] = [], outputRange: number[] = [];
  for (let frame = 0; frame < atlas.frames; frame++) {
    const cell = axis === 'x' ? frame % atlas.columns : Math.floor(frame / atlas.columns);
    inputRange.push(frame / atlas.frames, (frame + 1) / atlas.frames - 0.000001);
    outputRange.push(-cell * size, -cell * size);
  }
  inputRange.push(1); outputRange.push(0);
  return { inputRange, outputRange, extrapolate: 'clamp' as const };
}

export const startupTiming = { entrance: 400, minimum: 1700, networkDeadline: 4000, exit: 300, fade: 240, reducedMinimum: 140 } as const;
