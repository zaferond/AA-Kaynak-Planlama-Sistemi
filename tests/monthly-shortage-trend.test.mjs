import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMonthlyShortageTrend} from '../frontend/src/monthly-shortage-trend.ts';
import {buildCapacityIndex} from '../backend/domain/index.mjs';

const months=['2026-01','2026-02','2026-03'];
const capacity={
 'a|2026-01':{current:2,total:4},
 'b|2026-01':{current:5,total:3},
 'c|2026-01':{current:1,total:2},
 'a|2026-02':{current:4,total:4},
 'b|2026-02':{current:1,total:3},
 'c|2026-02':{current:2,total:2},
 'a|2026-03':{current:4,total:3},
 'b|2026-03':{current:3,total:3},
 'c|2026-03':{current:2,total:1},
};

test('monthly average shortage responds to leadership/team-selected ids',()=>{
 assert.deepEqual(buildMonthlyShortageTrend(capacity,['a','b','c'],months),[
  {month:'2026-01',total:3,average:1,teamCount:3},
  {month:'2026-02',total:2,average:2/3,teamCount:3},
  {month:'2026-03',total:0,average:0,teamCount:3},
 ]);
 assert.deepEqual(buildMonthlyShortageTrend(capacity,['a','c'],months).map(point=>point.average),[1.5,0,0]);
 assert.deepEqual(buildMonthlyShortageTrend(capacity,['b'],months).map(point=>point.average),[0,2,0]);
 assert.deepEqual(buildMonthlyShortageTrend(capacity,[],months).map(point=>point.average),[0,0,0]);
});

test('shortage uses the same active resource and allocation totals as report tables',()=>{
 const data={teams:[{id:'a',name:'Takım A',lead:'L',excelCapacity:0}],projects:[],resources:[{id:'r',name:'Çalışan',note:'',versions:[{effective:'2026-01',team:'a',lead:'L',status:'Aktif Çalışan',included:true,start:'2026-01-01',end:'',amount:1}]}],allocations:{'a|p|2026-01':2,'a|q|2026-01':0.5},revisions:{}};
 const index=buildCapacityIndex(data,['2026-01']);
 assert.deepEqual(buildMonthlyShortageTrend(index,['a'],['2026-01']),[{month:'2026-01',total:1.5,average:1.5,teamCount:1}]);
});
