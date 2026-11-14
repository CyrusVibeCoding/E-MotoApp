import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPoint, duration, metersBetween, segments, validFix } from './src/ride.ts';
const point = (longitude = 0, timestamp = 100000, segment = 0) => ({ latitude: 0, longitude, timestamp, accuracy: 5, segment });
const ride = () => ({ id: '1', startedAt: 100000, meters: 0, points: [point()] });
test('distance uses geodesic meters', () => assert.ok(Math.abs(metersBetween(point(), point(0.001)) - 111.195) < 0.1));
test('valid fixes require recent accurate coordinates', () => {
  assert.equal(validFix(point(), 100001), true);
  for (const p of [{ ...point(), accuracy: 80 }, { ...point(), accuracy: -1 }, { ...point(), latitude: 100 }, { ...point(), timestamp: 0 }, { ...point(), timestamp: 200000 }]) assert.equal(validFix(p, 100001), false);
});
test('movement adds distance', () => assert.ok(appendPoint(ride(), point(0.0001, 105000)).meters > 11));
test('stationary noise and duplicate fixes do not add distance', () => {
  const r = ride(); assert.equal(appendPoint(r, point(0.000001, 105000)).meters, 0); assert.equal(appendPoint(r, point(0.0001)), r);
});
test('implausible teleport is rejected', () => { const r = ride(); assert.equal(appendPoint(r, point(1, 101000)), r); });
test('GPS loss creates a disconnected segment without adding distance', () => {
  const r = appendPoint(ride(), point(0.001, 130000)); assert.equal(r.meters, 0); assert.equal(segments(r.points).length, 2);
  assert.ok(appendPoint(r, point(0.0011, 135000, 1)).meters > 11);
});
test('foreground interruption splits route even for short gaps', () => {
  const r = appendPoint(ride(), point(0.001, 105000, 1)); assert.equal(r.meters, 0); assert.equal(r.points[1].segment, 1);
});
test('duration does not wrap at an hour', () => assert.equal(duration(3661), '01:01:01'));
test('a minute of stationary fixes does not create a gap or accumulate noise', () => {
  let r = ride();
  for (let i=1; i<=30; i++) r = appendPoint(r, { ...point(i % 2 ? 0.00001 : -0.00001, 100000 + i*2000), accuracy: 10 });
  assert.equal(r.meters, 0); assert.equal(r.points.length, 1);
  r = appendPoint(r, point(0.00012, 162000));
  assert.ok(r.meters > 13); assert.equal(segments(r.points).length, 1);
});
test('noise within reported uncertainty is filtered', () => {
  const r = appendPoint(ride(), { ...point(0.00009, 102000), accuracy: 20 });
  assert.equal(r.meters, 0);
});
test('source text is valid UTF-8 without replacement characters', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['App.tsx', 'src/useRecorder.ts']) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(new URL(name, import.meta.url)));
    assert.ok(!text.includes('\uFFFD'));
  }
});
