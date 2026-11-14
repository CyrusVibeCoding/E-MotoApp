import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { memberStatus, normalizeCode, shareableFix } from './src/groupModel.ts';

test('sharing requires foreground consent session caller, fresh GPS and ready status', () => {
  const p = { latitude: 30, longitude: -95, accuracy: 5, timestamp: 100000, segment: 0 };
  assert.equal(shareableFix(p, 'GPS ready', true, 100001), p);
  assert.equal(shareableFix(p, 'GPS ready', false, 100001), null);
  assert.equal(shareableFix(p, 'GPS lost', true, 100001), null);
  assert.equal(shareableFix(p, 'GPS ready', true, 120001), null);
  assert.equal(normalizeCode(' abcd1234 '), 'ABCD1234');
});
test('live positions become last known on loss or age', () => {
  const m = { latitude: 30, longitude: -95, sharing: true, observed_at: new Date(100000).toISOString() };
  assert.equal(memberStatus(m, 100010, true), 'Live');
  assert.equal(memberStatus(m, 121000, true), 'Last known');
  assert.equal(memberStatus(m, 100010, false), 'Last known');
});

test('real PostgreSQL group authorization and cleanup', async t => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const c = '33333333-3333-4333-8333-333333333333';
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values('${a}'),('${b}'),('${c}');`);
  await db.exec(await readFile(new URL('./backend/group.sql', import.meta.url), 'utf8'));
  async function identity(uid, role = 'authenticated') {
    await db.exec(`reset role; set role ${role};`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  }
  async function call(action, payload = {}) {
    return (await db.query('select public.emoto_group($1, $2::jsonb) as result', [action, JSON.stringify(payload)])).rows[0].result;
  }
  let group;
  await t.test('anonymous database role cannot access RPC', async () => {
    await identity('', 'anon'); await assert.rejects(call('create', { name: 'Guest' }), /permission denied/);
  });
  await t.test('create is idempotent; join has names and an invite code', async () => {
    await identity(a); group = await call('create', { name: 'Rider A' });
    assert.match(group.code, /^[A-F0-9]{8}$/);
    assert.equal((await call('create', { name: 'Rider A' })).id, group.id);
    await identity(b);
    assert.match((await call('join', { name: 'B', code: 'INVALID' })).error, /Invalid/);
    const joined = await call('join', { name: 'Rider B', code: group.code.toLowerCase() });
    assert.equal(joined.members.length, 2);
  });
  await t.test('outsiders cannot read members or change a location', async () => {
    await identity(c); assert.equal((await call('sync', { group_id: group.id })).expired, true);
    await assert.rejects(db.query('select * from emoto_private.members'), /permission denied/);
  });
  await t.test('payload identity is ignored; a rider can only write their own fix', async () => {
    await identity(a);
    const result = await call('sync', { group_id: group.id, user_id: b, location: { latitude: 30, longitude: -95, accuracy: 5, timestamp: Date.now() } });
    assert.equal(result.members.find(m => m.id === a).latitude, 30);
    assert.equal(result.members.find(m => m.id === b).latitude, null);
    assert.equal(result.members.find(m => m.id === a).sharing, true);
    const rejected = await call('sync', { group_id: group.id, location: { latitude: 90, longitude: 0, accuracy: 500, timestamp: Date.now() } });
    assert.equal(rejected.members.find(m => m.id === a).latitude, 30);
    assert.equal(rejected.members.find(m => m.id === a).sharing, false);
  });
  await t.test('leave is idempotent, removes the position, and cannot remove another rider', async () => {
    await identity(a); await call('leave', { group_id: group.id, user_id: b }); await call('leave', { group_id: group.id });
    assert.equal((await call('sync', { group_id: group.id })).expired, true);
    await identity(b); assert.deepEqual((await call('sync', { group_id: group.id })).members.map(m => m.id), [b]);
  });
  await t.test('expired memberships cannot be revived by a heartbeat', async () => {
    await db.exec(`reset role; update emoto_private.members set lease_until = now() - interval '1 second';`);
    await identity(b); assert.equal((await call('sync', { group_id: group.id })).expired, true);
    assert.match((await call('join', { name: 'B', code: group.code })).error, /Invalid/);
  });
  await t.test('hard expiry and cleanup remove abandoned sessions and location records', async () => {
    await identity(a); const g = await call('create', { name: 'A' });
    await db.exec(`reset role; update emoto_private.groups set expires_at = now() - interval '1 second'; select emoto_private.cleanup();`);
    assert.equal((await db.query('select count(*)::int as n from emoto_private.members')).rows[0].n, 0);
    await identity(a); assert.equal((await call('sync', { group_id: g.id })).expired, true);
  });
  await t.test('invalid-code rate limiting persists across errors', async () => {
    await identity(c); let response;
    for (let i = 0; i < 11; i++) response = await call('join', { name: 'C', code: '00000000' });
    assert.match(response.error, /Too many attempts/);
  });
  await db.close();
});
