import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../backend/store.mjs';
import {SqlJsAdapter} from '../backend/adapters/sqljs.mjs';
import {migrate,validate} from '../backend/domain/index.mjs';
import {cleanMilestoneRanges,CRITICAL_DATE_OVERLAP_MESSAGE,milestoneRanges,rangeNotes,withMilestoneRanges} from '../frontend/src/milestone-ranges.ts';
import {milestoneBars} from '../frontend/src/milestone-bars.ts';

test('project milestones survive add, edit, delete and restart',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aa-milestones-'));
  const env={DB_PROVIDER:'sqljs',SQLJS_FILE:path.join(dir,'plan.sqlite')};
  const store=new Store({env});
  try{
    await store.connect();
    const project={id:'milestone_project',name:'Test Projesi',start:'2026-09',end:'2027-08',phases:{},phaseColors:{},milestones:[]};
    async function saveProject(next){
      await store.transaction(async c=>{
        const {data}=await store.read(c);
        const updated={...data,projects:[...data.projects.filter(p=>p.id!==next.id),next]};
        await store.persist(data,validate(updated),c);
      });
    }
    await saveProject(project);
    const milestone={id:'m1',name:'Tasarım Onayı',start:'2026-11-12',end:'2027-02-18',barColor:'purple',barStyle:'striped',barText:'PDR · Onay Bekleniyor'};
    await saveProject({...project,milestones:[milestone]});
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[milestone]);
    await assert.rejects(()=>saveProject({...project,milestones:[{...milestone,end:'2027-09-01'}]}),/Kilometre taşı proje dönemi içinde olmalı/);
    await assert.rejects(()=>saveProject({...project,milestones:[{...milestone,start:'2026-11-31'}]}),/Invalid input|Geçersiz gün|validation/i);
    await store.close();
    await store.connect();
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[milestone]);
    const multi={...milestone,additionalRanges:[{start:'2027-03-01',end:'2027-03-12',description:'Prototip onayı',color:'green'},{start:'2027-05-20',end:'2027-06-01',description:'Son değerlendirme',color:'amber'}]};
    await saveProject({...project,milestones:[multi]});
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[multi]);
    await assert.rejects(()=>saveProject({...project,milestones:[{...milestone,additionalRanges:[{start:'2027-01-01',end:'2027-01-05'}]}]}),error=>error.message===CRITICAL_DATE_OVERLAP_MESSAGE);
    await assert.rejects(()=>saveProject({...project,milestones:[{...milestone,additionalRanges:[{start:'2027-09-01',end:'2027-09-05'}]}]}),/proje dönemi içinde/);
    await assert.rejects(()=>saveProject({...project,milestones:[{...milestone,additionalRanges:[{start:'2027-03-01',end:'2027-03-12',color:'invalid'}]}]}),/Invalid enum value|invalid_enum_value/i);
    const fullRanges=Array.from({length:19},(_,index)=>({start:`2027-03-${String(index+1).padStart(2,'0')}`,end:`2027-03-${String(index+1).padStart(2,'0')}`,description:'x'.repeat(200),color:'green'}));
    await saveProject({...project,milestones:[{...milestone,additionalRanges:fullRanges}]});
    assert.equal((await store.read()).data.projects.find(p=>p.id===project.id).milestones[0].additionalRanges.length,19);
    await saveProject({...project,milestones:[multi]});
    await store.close();
    await store.connect();
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[multi]);
    const noted={...multi,barNotes:[{text:'Tasarım başladı',includeInReport:true},{text:'Onay bekleniyor',includeInReport:false}],additionalRanges:[{...multi.additionalRanges[0],notes:[{text:'Prototip tamamlandı',includeInReport:true},{text:'Test sürüyor',includeInReport:true}]},multi.additionalRanges[1]]};
    await saveProject({...project,milestones:[noted]});
    await store.close();
    await store.connect();
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[noted]);
    const longText='Uzun açıklama '.repeat(1000).trim();
    const lengthy={...noted,barText:longText,barNotes:[{text:longText,includeInReport:true}],additionalRanges:[{...multi.additionalRanges[0],description:longText,notes:[{text:longText,includeInReport:true}]},multi.additionalRanges[1]]};
    await saveProject({...project,milestones:[lengthy]});
    await store.close();
    await store.connect();
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[lengthy]);
    await assert.rejects(()=>saveProject({...project,milestones:[{...noted,barNotes:[{text:'',includeInReport:true}]}]}),/too_small|at least 1|Invalid input/i);
    await saveProject({...project,milestones:[{...milestone,name:'Tasarım Tamamlandı',end:'2026-12-09',barColor:'green',barStyle:'outline',barText:'Tamamlandı'}]});
    assert.equal((await store.read()).data.projects.find(p=>p.id===project.id).milestones[0].name,'Tasarım Tamamlandı');
    assert.equal((await store.read()).data.projects.find(p=>p.id===project.id).milestones[0].barText,'Tamamlandı');
    assert.equal((await store.read()).data.projects.find(p=>p.id===project.id).milestones[0].barColor,'green');
    const oldBackup=structuredClone((await store.read()).data);
    oldBackup.projects.find(p=>p.id===project.id).milestones=[{id:'old',name:'Yedek kaydı',start:'2026-11',end:'2026-12'}];
    assert.deepEqual(validate(migrate(oldBackup)).projects.find(p=>p.id===project.id).milestones,[{id:'old',name:'Yedek kaydı',start:'2026-11-01',end:'2026-12-31',barColor:'red',barStyle:'solid'}]);
    await saveProject(project);
    assert.deepEqual((await store.read()).data.projects.find(p=>p.id===project.id).milestones,[]);
  }finally{
    await store.close();
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('existing month milestones become full date ranges during migration',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aa-milestone-upgrade-'));
  const file=path.join(dir,'plan.sqlite');
  const adapter=new SqlJsAdapter(file);
  try{
    await adapter.open();
    await adapter.transaction(async c=>{
      await c.batch(await fs.readFile('backend/migrations/001_sqljs.sql','utf8'));
      await c.batch(await fs.readFile('backend/migrations/004_sqljs.sql','utf8'));
      await c.batch("INSERT INTO kp_settings VALUES(1,0,NULL); INSERT INTO kp_projects VALUES('p','Eski Proje','2026-01','2026-12'); INSERT INTO kp_project_milestones VALUES('p','m','Eski kilometre taşı','2026-02','2026-03');");
    });
    await adapter.close();
    const store=new Store({env:{DB_PROVIDER:'sqljs',SQLJS_FILE:file}});
    try{
      await store.connect();
      assert.equal((await store.db.query('SELECT MAX(version) AS v FROM kp_schema_migrations')).rows[0].v,22);
      assert.deepEqual((await store.read()).data.projects.find(p=>p.id==='p').milestones,[{id:'m',name:'Eski kilometre taşı',start:'2026-02-01',end:'2026-03-31',barColor:'red',barStyle:'solid'}]);
    }finally{await store.close()}
  }finally{
    if(adapter.db)await adapter.close();
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('multiple date ranges form separate bars on one monthly track',()=>{
 const milestone={start:'2026-01-01',end:'2026-01-05',barColor:'purple',barText:'İlk açıklama',additionalRanges:[{start:'2026-01-20',end:'2026-01-22',description:'İkinci açıklama',color:'green'}]};
 const ranges=milestoneRanges(milestone);
 const bars=milestoneBars(ranges,['2026-01','2026-02']);
 assert.equal(bars.length,2);
 assert.equal(bars[0].range.description,'İlk açıklama');
 assert.equal(bars[1].range.description,'İkinci açıklama');
 assert.equal(bars[0].range.color,'purple');
 assert.equal(bars[1].range.color,'green');
 assert.equal(bars[0].left,0);
 assert.ok(Math.abs(bars[0].width-5/31/2*100)<1e-10);
 assert.ok(Math.abs(bars[1].left-19/31/2*100)<1e-10);
 assert.ok(Math.abs(bars[1].width-3/31/2*100)<1e-10);
 assert.deepEqual(milestoneBars([{start:'2025-12-20',end:'2026-01-03'},{start:'2026-03-01',end:'2026-03-05'}],['2026-01','2026-02']).map(bar=>bar.range),[{start:'2025-12-20',end:'2026-01-03'}]);
 assert.deepEqual(withMilestoneRanges(milestone,[ranges[1]]),{start:ranges[1].start,end:ranges[1].end,barColor:'green',barText:'İkinci açıklama',barNotes:[{text:'İkinci açıklama',includeInReport:false}]});
 assert.deepEqual(rangeNotes(ranges[0]),[{text:'İlk açıklama',includeInReport:false}]);
 assert.deepEqual(cleanMilestoneRanges([{...ranges[0],notes:[{text:'  Hazır  ',includeInReport:true},{text:' ',includeInReport:false}]}])[0].notes,[{text:'Hazır',includeInReport:true}]);
 const legacy={...milestone,additionalRanges:[{start:'2026-01-20',end:'2026-01-22'}]};
 assert.equal(milestoneRanges(legacy)[1].color,'purple');
 assert.equal(withMilestoneRanges(legacy,milestoneRanges(legacy).map((range,index)=>index?range:{...range,color:'blue'})).additionalRanges[0].color,'purple');
});
