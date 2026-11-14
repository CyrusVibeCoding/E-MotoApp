import test from 'node:test';
import assert from 'node:assert/strict';
import {recordBatch,needsTracking} from './src/trackingCore.ts';
const p=(longitude,timestamp)=>({latitude:0,longitude,timestamp,accuracy:5,segment:0});
const data=()=>({version:1,bike:{make:'A',model:'B',nickname:'C'},rides:[],draft:{id:'1',startedAt:100000,points:[p(0,100000)],meters:0}});
test('overlapping task and foreground batches count movement only once',()=>{const batch=[p(0.0001,105000),p(0.0002,110000)];const first=recordBatch(data(),batch,110000);const second=recordBatch(first,batch,110000);assert.equal(second.draft.meters,first.draft.meters);assert.equal(second.draft.points.length,3);assert.equal(second.bike.nickname,'C');});
test('late batch after finish cannot recreate a ride',()=>{const d=data();d.rides=[{...d.draft,endedAt:110000}];d.draft=null;assert.equal(recordBatch(d,[p(0.001,111000)],111000),d);});
test('independent tracking demands',()=>{assert.equal(needsTracking(true,false),true);assert.equal(needsTracking(false,true),true);assert.equal(needsTracking(false,false),false);});
test('batched points sort by time and reject stale fixes',()=>{const r=recordBatch(data(),[p(.0002,110000),p(.0001,105000),p(1,50000)],110000);assert.equal(r.draft.points.length,3);assert.ok(r.draft.meters>20);});
