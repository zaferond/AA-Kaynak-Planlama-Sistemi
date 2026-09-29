import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTimelinePeriods} from '../frontend/src/timeline-periods.ts';
import {weeklyNoteLayout} from '../frontend/src/weekly-note-bars.ts';

test('dated descriptions occupy their own weeks and overlapping dates use separate lanes',()=>{
 const periods=projectTimelinePeriods(['2026-10'],true);
 const ranges=[{start:'2026-10-01',end:'2026-10-08',color:'blue',notes:[
  {text:'İlk',start:'2026-10-03',end:'2026-10-05',includeInReport:false},
  {text:'Çakışan',start:'2026-10-04',end:'2026-10-06',includeInReport:true,completed:true},
  {text:'Sonraki',start:'2026-10-18',end:'2026-10-20',includeInReport:false},
 ]}];
 const {bars,laneCount}=weeklyNoteLayout(ranges,periods);
 assert.deepEqual(bars.map(bar=>[bar.text,bar.lane]),[['İlk',0],['Çakışan',1],['Sonraki',0]]);
 assert.equal(laneCount,2);
 assert.equal(bars[1].completed,true);
 assert.ok(bars[2].left>=bars[0].left+bars[0].width);
 assert.equal(bars[0].width,2/periods.length*100);
});

test('one-day notes fill a weekly cell and separate notes in that week are stacked',()=>{
 const periods=projectTimelinePeriods(['2026-10'],true);
 const ranges=[{start:'2026-10-01',end:'2026-10-31',notes:[
  {text:'Pazartesi',start:'2026-10-12',end:'2026-10-12',includeInReport:false},
  {text:'Cuma',start:'2026-10-16',end:'2026-10-16',includeInReport:false},
 ]}];
 const {bars,laneCount}=weeklyNoteLayout(ranges,periods);
 assert.equal(bars[0].left,bars[1].left);
 assert.equal(bars[0].width,100/periods.length);
 assert.deepEqual(bars.map(bar=>bar.lane),[0,1]);
 assert.equal(laneCount,2);
});

test('notes outside the parent bar remain visible; undated legacy notes stay unpositioned',()=>{
 const periods=projectTimelinePeriods(['2026-10'],true);
 const ranges=[{start:'2026-09-01',end:'2026-09-30',color:'green',notes:[
  {text:'Ekim notu',start:'2026-10-12',end:'2026-10-13',includeInReport:true},
  {text:'Eski açıklama',includeInReport:false},
  {text:'Dönem dışı',start:'2026-11-01',end:'2026-11-02',includeInReport:false},
 ]}];
 const {bars,undated}=weeklyNoteLayout(ranges,periods);
 assert.deepEqual(bars.map(bar=>bar.text),['Ekim notu']);
 assert.deepEqual(undated.map(note=>note.text),['Eski açıklama']);
 assert.equal(bars[0].color,'green');
});
