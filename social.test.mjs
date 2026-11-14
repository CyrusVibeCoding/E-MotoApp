import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sharedRoute, insidePrivacyZone } from './src/features/privacy.ts';
import { metersBetween } from './src/ride.ts';
import { needsTracking } from './src/trackingCore.ts';

const point = (longitude, segment = 0) => ({ latitude: 30, longitude, segment, accuracy: 5, timestamp: 1000 });
test('shared routes omit endpoints, zones, sparse edges and recorded gaps', () => {
  const points = Array.from({ length: 101 }, (_, i) => point(-95 + i * 0.001, i < 50 ? 0 : 1));
  const ride = { id: 'r', startedAt: 0, endedAt: 1000, meters: 9000, points };
  const zone = { id: 'home', latitude: 30, longitude: -94.975, radius: 500 };
  const route = sharedRoute(ride, [zone]);
  assert.ok(route.length >= 3);
  for (const line of route) {
    for (const p of line) {
      assert.deepEqual(Object.keys(p).sort(), ['latitude', 'longitude']);
      assert.ok(metersBetween(p, points[0]) > 500);
      assert.ok(metersBetween(p, points.at(-1)) > 500);
      assert.ok(metersBetween(p, zone) > 500);
    }
    assert.ok(!(line[0].longitude < points[50].longitude && line.at(-1).longitude >= points[50].longitude));
  }
  assert.deepEqual(sharedRoute({ ...ride, points: points.slice(0, 5) }, []), []);
  assert.deepEqual(sharedRoute({ ...ride, points: [point(NaN), ...points] }, []), []);
  assert.equal(insidePrivacyZone(zone, [zone]), true);
});
test('friend sharing has independent GPS demand', () => {
  for (const recording of [false, true]) for (const group of [false, true]) for (const friends of [false, true]) {
    assert.equal(needsTracking(recording, group, friends), recording || group || friends);
  }
});

test('social RPC enforces friendships, privacy, blocking, ownership and publication retries', async t => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const c = '33333333-3333-4333-8333-333333333333';
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values('${a}'),('${b}'),('${c}');`);
  await db.exec(await readFile(new URL('./backend/social.sql', import.meta.url), 'utf8'));
  async function identity(uid, role = 'authenticated') {
    await db.exec(`reset role; set role ${role};`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  }
  async function call(action, payload = {}) {
    return (await db.query('select public.repride_social($1,$2::jsonb) result', [action, JSON.stringify(payload)])).rows[0].result;
  }
  for (const [id, username] of [[a, 'rider_a'], [b, 'rider_b'], [c, 'rider_c']]) {
    await identity(id); await call('save_profile', { username, display_name: username, build: { make: 'Sur-Ron', mods: [] } });
  }
  await t.test('invalid shared builds are rejected', async () => {
    await identity(a);
    for (const build of [{ mods: [null] }, { mods: [{ id: 'x', name: {}, category: 'Upgrade' }] }, { color: 'invalid' }]) {
      await assert.rejects(call('save_profile', { username: 'rider_a', display_name: 'A', build }), /Invalid/);
    }
  });
  await t.test('anon role and direct table access are denied', async () => {
    await identity('', 'anon'); await assert.rejects(call('me'), /permission denied/);
    await identity(a); await assert.rejects(db.query('select * from repride_private.profiles'), /permission denied/);
  });
  await t.test('private is default, follow grants no private activity or build', async () => {
    await identity(a); assert.equal((await call('me')).profile.visibility, 'private');
    await call('post', { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body: 'A good ride.' });
    await call('publish_ride', { origin: 'install:r1', ride_date: '2026-11-14', meters: 9000, route: [[{ latitude: 30, longitude: -95 }]] });
    await identity(b); await call('follow', { target: a });
    assert.equal((await call('profile', { target: a })).can_read, false);
    assert.equal((await call('profile', { target: a })).build, null);
    assert.deepEqual(await call('feed'), []);
  });
  await t.test('only recipient can accept, friends gain activity and location', async () => {
    await identity(b); await call('request', { target: a }); await call('accept', { target: a });
    assert.equal((await call('profile', { target: a })).friend, false);
    await identity(a); await call('accept', { target: b });
    await call('presence', { latitude: 30, longitude: -95, timestamp: Date.now(), until: Date.now() + 900000 });
    await identity(b); assert.equal((await call('feed')).length, 2);
    assert.equal((await call('locations')).length, 1);
    await identity(c); assert.deepEqual(await call('locations'), []);
  });
  await t.test('payload owner cannot spoof identity and publish retries preserve hidden state', async () => {
    await identity(a); await call('ride_visibility', { origin: 'install:r1', hidden: true, map_hidden: true });
    await call('publish_ride', { origin: 'install:r1', ride_date: '2026-11-14', meters: 9000, owner: b, route: [] });
    assert.equal((await call('feed')).filter(x => x.kind === 'ride').length, 1);
    await identity(b); assert.equal((await call('feed')).filter(x => x.kind === 'ride').length, 0);
    await call('ride_visibility', { origin: 'install:r1', hidden: false });
    assert.equal((await call('feed')).filter(x => x.kind === 'ride').length, 0);
  });
  await t.test('hidden map, clear route, deletion and retries cannot restore private geometry', async () => {
    await identity(a); await call('ride_visibility', { origin: 'install:r1', hidden: false });
    await identity(b); assert.deepEqual((await call('feed')).find(x => x.kind === 'ride').route, []);
    await identity(a); await call('clear_routes');
    await assert.rejects(call('publish_ride', { origin: 'stale', ride_date: '2026-11-14', meters: 9000, route: [] }), /Privacy settings changed/); await call('ride_visibility', { origin: 'install:r1', map_hidden: false });
    assert.deepEqual((await call('feed')).find(x => x.kind === 'ride').route, []);
    await call('ride_visibility', { origin: 'install:r1', deleted: true });
    await call('publish_ride', { origin: 'install:r1', privacy_revision: 1, ride_date: '2026-11-14', meters: 9000, route: [] });
    assert.equal((await call('feed')).filter(x => x.kind === 'ride').length, 0);
  });
  await t.test('unfriend revokes private data immediately and public profile grants permitted reads', async () => {
    await identity(a); await call('remove_friend', { target: b });
    await identity(b); assert.deepEqual(await call('locations'), []); assert.deepEqual(await call('feed'), []);
    await identity(a); await call('save_profile', { username: 'rider_a', display_name: 'A', visibility: 'public', build: {} });
    await identity(b); assert.equal((await call('feed')).length, 1);
  });
  await t.test('block revokes public profile, search and feed access in both directions', async () => {
    await identity(a); await call('block', { target: b });
    await identity(b); assert.deepEqual(await call('feed'), []);
    assert.deepEqual(await call('search', { query: 'rider_a' }), []);
    await assert.rejects(call('profile', { target: a }), /unavailable/);
    await assert.rejects(call('request', { target: a }), /unavailable/);
  });
  await db.close();
});

test('new measurements exclude gaps and legacy measurements remain unavailable', async () => {
  const { appendPoint } = await import('./src/ride.ts');
  const a = { ...point(-95), timestamp: 100000 };
  const b = { ...point(-94.9995), timestamp: 110000 };
  const base = { id: 'measured', startedAt: 100000, points: [a], meters: 0 };
  assert.equal(appendPoint(base, b).measurements, undefined);
  const measured = appendPoint({ ...base, measurements: { movingMeters: 0, movingSeconds: 0, topSpeed: 0 } }, b);
  assert.equal(measured.measurements.movingSeconds, 10);
  assert.ok(measured.measurements.topSpeed > 4);
  const afterGap = appendPoint(measured, { ...b, longitude: -94.99, timestamp: 140000, segment: 1 });
  assert.deepEqual(afterGap.measurements, measured.measurements);
});
