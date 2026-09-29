import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHeadcountTrend} from '../frontend/src/headcount-trend.ts';

const version=(status,effective,start='',end='',extras={})=>({status,effective,start,end,team:'t1',lead:'L1',included:true,amount:1,...extras});
const resource=(id,...versions)=>({id,name:id,versions});
const data={teams:[{id:'t1',lead:'L1'},{id:'t2',lead:'L2'}],resources:[
 resource('employee',version('Aktif Çalışan','2026-01','','',{amount:0.5})),
 resource('gear',version('Pasif İlan','2026-01'),version('Gear Up','2026-02')),
 resource('hourly',version('SAAT Ücretli Ofis Ç.','2026-01','2026-02','2026-03')),
 resource('posting',version('Aktif İlan','2026-01','2026-03','2026-04',{amount:2}),version('Aktif Çalışan','2026-04','2026-03')),
 resource('other-team',version('Aktif Çalışan','2026-01','','',{team:'t2',lead:'L2'})),
 resource('excluded',version('Aktif Çalışan','2026-01','','',{included:false})),
]};
const months=['2026-01','2026-02','2026-03','2026-04'];

test('headcount trend uses a running average and adds active postings only in future months',()=>{
 const points=buildHeadcountTrend(data,['t1'],['L1'],months,'2026-02');
 assert.deepEqual(points.map(p=>p.actualCount),[1,3,3,3]);
 assert.deepEqual(points.map(p=>p.postings),[0,0,1,0]);
 assert.deepEqual(points.map(p=>p.actualAverage),[1,2,null,null]);
 assert.equal(points[2].projectedAverage,8/3);
 assert.equal(points[3].projectedAverage,11/4);
 assert.deepEqual(points.map(p=>p.future),[false,false,true,true]);
});

test('headcount trend respects teams and leaders and counts records rather than FTE amounts',()=>{
 const all=buildHeadcountTrend(data,['t1','t2'],[],months,'2026-02');
 assert.deepEqual(all.map(p=>p.actualCount),[2,4,4,4]);
 const leadOnly=buildHeadcountTrend(data,['t1','t2'],['L2'],months,'2026-02');
 assert.deepEqual(leadOnly.map(p=>p.actualCount),[1,1,1,1]);
 assert.deepEqual(leadOnly.map(p=>p.postings),[0,0,0,0]);
});

test('departed staff remain in historical headcount only through the exit date',()=>{
 const departed={teams:[{id:'t1',lead:'L1'}],resources:[resource('former',version('İşten Ayrıldı','2026-01','2026-01-16','2026-01-31'))]};
 const points=buildHeadcountTrend(departed,['t1'],[],['2026-01','2026-02'],'2026-02');
 assert.equal(points[0].active,16/31);
 assert.equal(points[1].active,0);
});
