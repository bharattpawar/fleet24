import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterFrameTrack } from '../src/utils/startupCycle.ts';

const root = new URL('../assets/illustrations/startup/', import.meta.url);
const atlas = JSON.parse(readFileSync(new URL('character-cycle.json', root), 'utf8'));
function sample(track, phase) {
  const i = track.inputRange.findIndex((end, index) => index > 0 && phase <= end);
  if (i < 0) return track.outputRange.at(-1);
  const t = (phase - track.inputRange[i - 1]) / (track.inputRange[i] - track.inputRange[i - 1]);
  return track.outputRange[i - 1] + t * (track.outputRange[i] - track.outputRange[i - 1]);
}

test('ships the correct original character and a valid lightweight offline atlas/poster pair', () => {
  assert.equal(atlas.role, 'rider');
  assert.equal(atlas.frames, atlas.columns * atlas.rows);
  const cycle = readFileSync(new URL('character-cycle.webp', root));
  const poster = readFileSync(new URL('character-poster.webp', root));
  for (const data of [cycle, poster]) {
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  }
  assert.equal(cycle.length, atlas.atlasBytes);
  assert.ok(cycle.length < 1_500_000);
  assert.notDeepEqual(cycle, poster);
});

test('selects every complete pose at phone and desktop sizes, including all row boundaries', () => {
  for (const size of [180, 320, 360]) {
    const x = characterFrameTrack(atlas, 'x', size), y = characterFrameTrack(atlas, 'y', size);
    for (let i = 1; i < x.inputRange.length; i++) assert.ok(x.inputRange[i] > x.inputRange[i - 1]);
    for (let frame = 0; frame < atlas.frames; frame++) {
      const phase = (frame + 0.5) / atlas.frames;
      assert.ok(Math.abs(sample(x, phase) + (frame % atlas.columns) * size) < 0.001);
      assert.ok(Math.abs(sample(y, phase) + Math.floor(frame / atlas.columns) * size) < 0.001);
    }
  }
});

test('holds each pose instead of panning through the sheet, then loops back to frame zero', () => {
  const track = characterFrameTrack(atlas, 'x', 320);
  for (let frame = 0; frame < atlas.frames; frame++) {
    assert.equal(sample(track, (frame + 0.1) / atlas.frames), sample(track, (frame + 0.9) / atlas.frames));
  }
  assert.equal(sample(track, 1), 0);
  assert.equal(sample(characterFrameTrack(atlas, 'y', 320), 1), 0);
});
