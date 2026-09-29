import test from 'node:test';
import assert from 'node:assert/strict';
import {applyChanges} from '../backend/operations.mjs';
import {validate,currentPlanningMonth,personHoursInMonth,trainingHoursInMonth,DEFAULT_MONTHLY_HOURS} from '../backend/domain/index.mjs';
import {Store} from '../backend/store.mjs';
import {hashPassword} from '../backend/auth.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const admin={_id:'root-admin',role:'admin',leaders:[]};
const employee={_id:'u',role:'normal',resourceId:'r',leaders:[]};
const other={_id:'v',role:'normal',resourceId:'other',leaders:[]};
const fixture=()=>({
 teams:[{id:'t',name:'Takım',lead:'L',excelCapacity:0,catalog:true}],
 projects:[{id:'p',name:'Proje',start:'2025-01',end:'2030-12',phases:{}}],
 resources:[{id:'r',name:'Çalışan',note:'',versions:[{effective:'2025-01',team:'t',lead:'L',status:'Aktif Çalışan',included:true,start:'2025-01-01',end:'',amount:1}]}],
 allocations:{},actualAllocations:{},actualPercentEntries:{},actualWorkedHours:{},workCalendar:{},personCalendar:{},revisions:{},leaders:['L'],catalogVersion:2,
});
const dayInMonth=(month,day)=>month+'-'+String(day).padStart(2,'0');
const weekday=(month)=>{for(let day=1;day<=28;day++){const date=dayInMonth(month,day),n=new Date(date+'T12:00:00Z').getUTCDay();if(n>0&&n<6)return date}throw Error('weekday missing')};
const nextWeekday=(month,after)=>{for(let day=Number(after.slice(-2))+1;day<=28;day++){const date=dayInMonth(month,day),n=new Date(date+'T12:00:00Z').getUTCDay();if(n>0&&n<6)return date}throw Error('next weekday missing')};

test('shared and personal days recalculate actual percentages while preserving allocated hours',()=>{
 const d=fixture(),month=currentPlanningMonth(),date=weekday(month),key='r|p|'+month;
 const startHours=personHoursInMonth(month,'r');
 applyChanges(d,admin,[{kind:'actual',id:key,value:{unit:'percent',value:50},revision:0}]);
 const amount=d.actualAllocations[key];
 assert.equal(amount,startHours/2/DEFAULT_MONTHLY_HOURS);
 applyChanges(d,employee,[{kind:'personDay',id:'r|'+date,value:{type:'leave',hours:2.5,label:'İzin'},revision:0}]);
 assert.equal(d.actualAllocations[key],amount);
 assert.equal(d.actualPercentEntries[key],amount*DEFAULT_MONTHLY_HOURS/(startHours-2.5)*100);
 assert.equal(d.revisions['actual:'+key],2);
 assert.equal(validate(structuredClone(d)).personCalendar['r|'+date].hours,2.5);
 assert.throws(()=>applyChanges(d,other,[{kind:'personDay',id:'r|'+date,operation:'delete',revision:1}]),error=>error.status===403);
 assert.throws(()=>applyChanges(d,employee,[{kind:'calendar',id:'shared',value:{},revision:0}]),error=>error.status===403);
 assert.throws(()=>applyChanges(d,{_id:'manager',role:'manager',leaders:['L']},[{kind:'calendar',id:'shared',value:{},revision:0}]),error=>error.status===403);
 applyChanges(d,admin,[{kind:'calendar',id:'shared',value:{[date]:{type:'official',label:'Tatil',fraction:1}},revision:0}]);
 assert.equal(d.actualAllocations[key],amount);
 assert.equal(d.actualPercentEntries[key],amount*DEFAULT_MONTHLY_HOURS/(startHours-9)*100);
 applyChanges(d,admin,[{kind:'workedHours',id:'r|'+month,value:220,revision:0}]);
 const manualPercent=d.actualPercentEntries[key];
 applyChanges(d,employee,[{kind:'personDay',id:'r|'+date,operation:'delete',revision:1}]);
 assert.equal(d.actualPercentEntries[key],manualPercent);
 assert.equal(d.actualAllocations[key],amount);
});

test('training counts toward distributed percentage without reducing hours; leave reduces even manual hours',()=>{
 const d=fixture(),month=currentPlanningMonth(),date=weekday(month),leaveDate=nextWeekday(month,date),key='r|p|'+month;
 const base=personHoursInMonth(month,'r');
 applyChanges(d,employee,[{kind:'personDay',id:'r|'+date,value:{type:'training',hours:3,label:'Eğitim'},revision:0}]);
 assert.equal(personHoursInMonth(month,'r',d.workCalendar,d.personCalendar),base);
 assert.equal(trainingHoursInMonth(month,'r',d.workCalendar,d.personCalendar),3);
 assert.throws(()=>applyChanges(structuredClone(d),admin,[{kind:'actual',id:key,value:{unit:'percent',value:100},revision:0}]),/%100/);
 applyChanges(d,admin,[{kind:'actual',id:key,value:{unit:'percent',value:40},revision:0}]);
 const projectAmount=d.actualAllocations[key];
 const distributedPercent=(projectAmount+3/DEFAULT_MONTHLY_HOURS)/(base/DEFAULT_MONTHLY_HOURS)*100;
 assert(distributedPercent>40);
 applyChanges(d,admin,[{kind:'workedHours',id:'r|'+month,value:220,revision:0}]);
 applyChanges(d,employee,[{kind:'personDay',id:'r|'+leaveDate,value:{type:'leave',hours:4,label:'Yıllık izin'},revision:0}]);
 assert.equal(personHoursInMonth(month,'r',d.workCalendar,d.personCalendar),base-4);
 assert.equal(trainingHoursInMonth(month,'r',d.workCalendar,d.personCalendar),3);
 assert.equal(d.actualPercentEntries[key],projectAmount*DEFAULT_MONTHLY_HOURS/216*100);
});

test('shared holidays and personal absences persist with revisions after restart',async()=>{
 const dir=await fs.mkdtemp(path.resolve('tests/local-calendar-'));
 const env={DB_PROVIDER:'sqljs',SQLJS_FILE:path.join(dir,'calendar.sqlite')};
 let store=new Store({env});
 try{
  await store.connect();
  await store.bootstrapUser({_id:'root-admin',username:'calendar.admin',name:'Admin',role:'admin',leaders:[],active:true,password:await hashPassword('Calendar-test-284!'),revision:1,version:1});
  const active=await store.findUser({id:'root-admin'});
  await store.mutate(active,d=>{const team=d.teams[0];d.resources.push({id:'r',name:'Çalışan',note:'',versions:[{effective:'2026-01',team:team.id,lead:team.lead,status:'Aktif Çalışan',included:true,start:'2026-01-01',end:'',amount:1}]})});
  await store.mutate(active,d=>applyChanges(d,active,[
   {kind:'calendar',id:'shared',value:{'2026-09-01':{type:'official',label:'Tatil',fraction:1}},revision:0},
   {kind:'personDay',id:'r|2026-09-02',value:{type:'training',hours:3,label:'Eğitim'},revision:0},
  ]));
  await store.close();
  store=new Store({env});await store.connect();
  const reloaded=(await store.read()).data;
  assert.equal(reloaded.workCalendar['2026-09-01'].label,'Tatil');
  assert.equal(reloaded.personCalendar['r|2026-09-02'].hours,3);
  assert.equal(reloaded.revisions['calendar:shared'],1);
  assert.equal(reloaded.revisions['personDay:r|2026-09-02'],1);
 }finally{await store.close();await fs.rm(dir,{recursive:true,force:true})}
});

test('migration recalculates old training percentages without changing project hours',async()=>{
 const dir=await fs.mkdtemp(path.resolve('tests/local-training-migration-'));
 const env={DB_PROVIDER:'sqljs',SQLJS_FILE:path.join(dir,'plan.sqlite')};
 let store=new Store({env});
 try{
  await store.connect();
  await store.bootstrapUser({_id:'root-admin',username:'migration.admin',name:'Admin',role:'admin',leaders:[],active:true,password:await hashPassword('Migration-test-284!'),revision:1,version:1});
  const active=await store.findUser({id:'root-admin'}),month='2026-09',date='2026-09-02',amount=0.5;
  const automatic=personHoursInMonth(month,'r');
  await store.mutate(active,d=>{
   const team=d.teams[0];
   d.projects.push({id:'p',name:'Proje',start:'2026-01',end:'2026-12',phases:{}});
   d.resources.push({id:'r',name:'Çalışan',note:'',versions:[{effective:'2026-01',team:team.id,lead:team.lead,status:'Aktif Çalışan',included:true,start:'2026-01-01',end:'',amount:1}]});
   d.personCalendar={['r|'+date]:{type:'training',hours:3,label:'Eğitim'}};
   d.actualAllocations={['r|p|'+month]:amount};
   d.actualPercentEntries={['r|p|'+month]:amount*DEFAULT_MONTHLY_HOURS/automatic*100};
  });
  await store.transaction(async c=>{
   await c.query('UPDATE kp_actual_percent_entries SET percent=@p0 WHERE resource_id=@p1 AND project_id=@p2 AND month=@p3',[amount*DEFAULT_MONTHLY_HOURS/(automatic-3)*100,'r','p',month]);
   await c.query('DELETE FROM kp_schema_migrations WHERE version=22');
  });
  await store.close();store=new Store({env});await store.connect();
  const data=(await store.read()).data;
  assert.equal(data.actualAllocations['r|p|'+month],amount);
  assert(Math.abs(data.actualPercentEntries['r|p|'+month]-amount*DEFAULT_MONTHLY_HOURS/automatic*100)<1e-10);
  assert.equal(data.revisions['actual:r|p|'+month],1);
  assert.equal((await store.db.query('SELECT MAX(version) AS version FROM kp_schema_migrations')).rows[0].version,22);
 }finally{await store.close();await fs.rm(dir,{recursive:true,force:true})}
});
