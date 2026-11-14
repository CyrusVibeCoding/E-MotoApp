import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, emptyData } from './src/storageCore.ts';
const p = { latitude: 30, longitude: -95, timestamp: 100000, accuracy: 5, segment: 0 };
const ride = { id: 'walk', startedAt: 100000, endedAt: 160000, meters: 123.45, points: [p, {...p, longitude: -95.001, timestamp: 160000}] };
function memory() {
 let raw = null;
 return { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
}
test('fresh storage instance retains route, stats and bike after reload', async () => {
 const adapter = memory();
 const saved = { ...emptyData, rides: [ride], bike: { make: 'Sur-Ron', model: 'Light Bee', nickname: 'My bike' } };
 await createStorage(adapter).writeData(saved);
 assert.deepEqual(await createStorage(adapter).readData(), saved);
});
test('queued draft checkpoint cannot replace completed ride', async () => {
 const store = createStorage(memory());
 const draft = {...ride}; delete draft.endedAt;
 const checkpoint = store.writeData({ ...emptyData, draft });
 const finished = store.writeData({ ...emptyData, rides: [ride] });
 await Promise.all([checkpoint, finished]);
 const loaded = await store.readData();
 assert.equal(loaded.draft, null); assert.deepEqual(loaded.rides, [ride]);
});
test('writer recovers after storage failure', async () => {
 let fail = true; const adapter = memory();
 const store = createStorage({ ...adapter, setItem: async (key, value) => { if (fail) { fail=false; throw Error('Disk full'); } await adapter.setItem(key,value); } });
 await assert.rejects(store.writeData(emptyData));
 await store.writeData({ ...emptyData, rides: [ride] });
 assert.deepEqual((await store.readData()).rides, [ride]);
});
test('corrupt documents fail closed', async () => {
 for (const raw of ['{', JSON.stringify({...emptyData, rides:[{id:'bad'}]}), JSON.stringify({...emptyData, bike:{}})]) {
  await assert.rejects(createStorage({getItem: async () => raw, setItem: async () => {}}).readData());
 }
});
