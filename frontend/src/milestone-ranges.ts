import type {Milestone,MilestoneNote,MilestoneRange,Project} from './model';

export const CRITICAL_DATE_OVERLAP_MESSAGE='Güncellemek istediğiniz tarih diğer kritik tarihlerin içerisindeki bir tarihtir. Tekrar kontrol ediniz.';

export function rangeNotes(range:MilestoneRange):MilestoneNote[]{
 return range.notes??(range.description?[{text:range.description,includeInReport:false}]:[]);
}

export function noteDates(note:MilestoneNote,range:MilestoneRange){
 return {start:note.start??range.start,end:note.end??range.end};
}

export function datedNotes(range:MilestoneRange):MilestoneNote[]{
 return rangeNotes(range).map(note=>({...note,...noteDates(note,range)}));
}

/** Recalculate one bar from its nonempty subtask dates. Incomplete edits retain the current bar. */
export function rangeWithNoteDates(range:MilestoneRange,notes:MilestoneNote[]):MilestoneRange{
 const next={...range,description:notes[0]?.text||'',notes};
 const dated=notes.filter(note=>note.text.trim()).map(note=>noteDates(note,range));
 if(!dated.length||dated.some(note=>!note.start||!note.end||note.start>note.end))return next;
 return {...next,start:dated.reduce((first,note)=>note.start<first?note.start:first,dated[0].start),end:dated.reduce((last,note)=>note.end>last?note.end:last,dated[0].end)};
}

/** Use the same date checks in the project editor and the critical topics report. */
export function assertMilestoneDateRanges(project:Pick<Project,'start'|'end'>,ranges:MilestoneRange[]):void{
 const sorted=[...ranges].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
 for(const [index,range] of sorted.entries()){
  if(!range.start||!range.end)throw Error('Tüm tarih aralıklarını doldurun.');
  if(range.start>range.end)throw Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  if(range.start<project.start+'-01'||range.end.slice(0,7)>project.end)throw Error('Bilgi tarihleri proje dönemi içinde olmalı.');
  if(index&&range.start<=sorted[index-1].end)throw Error(CRITICAL_DATE_OVERLAP_MESSAGE);
  for(const note of rangeNotes(range)){
   if(note.includeInReport&&!note.text.trim())throw Error('Rapora eklenecek açıklama boş olamaz.');
   if(!note.text.trim())continue;
   const {start,end}=noteDates(note,range);
   if(!start||!end||start>end||start<project.start+'-01'||end.slice(0,7)>project.end)throw Error('Açıklama başlangıç ve bitiş tarihleri geçerli sırada ve proje dönemi içinde olmalı.');
  }
 }
}

function savedNotes(range:MilestoneRange):MilestoneNote[]{
 return rangeNotes(range).map(note=>({text:note.text.trim(),includeInReport:note.includeInReport,...(note.completed?{completed:true}:{}),...(note.start!==undefined?{start:note.start}:{}),...(note.end!==undefined?{end:note.end}:{})})).filter(note=>note.text);
}

export function cleanMilestoneRanges(ranges:MilestoneRange[]):MilestoneRange[]{
 return ranges.map(range=>{const notes=savedNotes(range);return {...range,description:notes[0]?.text||'',notes}});
}

export function milestoneRanges(milestone:Milestone):MilestoneRange[]{
 const color=milestone.barColor||'red';
 return [{start:milestone.start,end:milestone.end,color,...(milestone.barText!==undefined?{description:milestone.barText}:{}),notes:milestone.barNotes??(milestone.barText?[{text:milestone.barText,includeInReport:false}]:[])},...(milestone.additionalRanges||[]).map(range=>({...range,color:range.color||color,notes:rangeNotes(range)}))];
}

export function withMilestoneRanges(milestone:Milestone,ranges:MilestoneRange[]):Milestone{
 if(!ranges.length)throw Error('En az bir tarih aralığı gereklidir.');
 const {additionalRanges:_,barText:__,barNotes:___,barColor:____,...rest}=milestone;
 const [first,...additionalRanges]=ranges;
 const firstNotes=rangeNotes(first);
 return {...rest,start:first.start,end:first.end,barColor:first.color||milestone.barColor||'red',barText:firstNotes[0]?.text||'',barNotes:firstNotes,...(additionalRanges.length?{additionalRanges:additionalRanges.map(range=>{const notes=rangeNotes(range);return {...range,description:notes[0]?.text||'',notes}})}:{})};
}

export const shiftCalendarDate=(date:string,days:number)=>{
 const value=new Date(date+'T12:00:00Z');
 value.setUTCDate(value.getUTCDate()+days);
 return value.toISOString().slice(0,10);
};

/** Move one bar and its dated notes by the same number of calendar days. */
export function shiftMilestoneRange(project:Pick<Project,'start'|'end'>,milestone:Milestone,rangeIndex:number,days:number):Milestone{
 const ranges=milestoneRanges(milestone);
 if(!Number.isInteger(days)||rangeIndex<0||rangeIndex>=ranges.length)throw Error('Taşınacak tarih aralığı bulunamadı.');
 const moved=ranges.map((range,index)=>index===rangeIndex?{
  ...range,
  start:shiftCalendarDate(range.start,days),
  end:shiftCalendarDate(range.end,days),
  notes:rangeNotes(range).map(note=>({
   ...note,
   ...(note.start!==undefined?{start:shiftCalendarDate(note.start,days)}:{}),
   ...(note.end!==undefined?{end:shiftCalendarDate(note.end,days)}:{}),
  })),
 }:range);
 assertMilestoneDateRanges(project,moved);
 return withMilestoneRanges(milestone,moved);
}

/** Resize one end of a bar while retaining every note's existing dates. */
export function resizeMilestoneRange(project:Pick<Project,'start'|'end'>,milestone:Milestone,rangeIndex:number,edge:'start'|'end',days:number):Milestone{
 const ranges=milestoneRanges(milestone);
 if(!Number.isInteger(days)||rangeIndex<0||rangeIndex>=ranges.length)throw Error('Düzenlenecek tarih aralığı bulunamadı.');
 const resized=ranges.map((range,index)=>index===rangeIndex?{
  ...range,
  [edge]:shiftCalendarDate(range[edge],days),
  notes:datedNotes(range),
 }:range);
 assertMilestoneDateRanges(project,resized);
 return withMilestoneRanges(milestone,resized);
}
