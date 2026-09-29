import {Plus,Trash2} from 'lucide-react';
import type {CSSProperties} from 'react';
import {phasePalette} from './model';
import type {Milestone,MilestoneNote,MilestoneRange} from './model';
import {addMilestoneNote,datedNotes,milestoneRanges,noteDates,rangeNotes,rangeWithNoteDates,removeMilestoneNote,removeMilestoneRange,withMilestoneRanges} from './milestone-ranges';

type Props={value:Milestone;projectStart:string;projectEnd:string;onChange:(value:Milestone)=>void};
export default function MilestoneDateEditor({value,projectStart,projectEnd,onChange}:Props){
 const ranges=milestoneRanges(value);
 const min=projectStart+'-01';
 const max=new Date(Date.UTC(Number(projectEnd.slice(0,4)),Number(projectEnd.slice(5,7)),0)).toISOString().slice(0,10);
 function updateRange(index:number,changes:Partial<MilestoneRange>){
  onChange(withMilestoneRanges(value,ranges.map((range,i)=>i===index?{...range,...(('start' in changes||'end' in changes)?{notes:datedNotes(range)}:{}),...changes}:range)));
 }
 function updateNote(index:number,noteIndex:number,changes:Partial<MilestoneNote>){
  const range=ranges[index];
  const notes=datedNotes(range);
  const next=notes.map((note,i)=>i===noteIndex?{...note,...changes}:note);
  const recalculate='start' in changes||'end' in changes||('text' in changes&&(!notes[noteIndex]?.text.trim()||!changes.text?.trim()));
  onChange(withMilestoneRanges(value,ranges.map((item,i)=>i===index?(recalculate?rangeWithNoteDates(item,next):{...item,notes:next,description:next[0]?.text||''}):item)));
 }
 function addNote(index:number){
  onChange(addMilestoneNote(value,index));
 }
 function addRange(){
  const last=ranges.at(-1)!;
  const next=last.end?new Date(last.end+'T12:00:00Z'):null;
  next?.setUTCDate(next.getUTCDate()+1);
  const date=next&&next.toISOString().slice(0,10)<=max?next.toISOString().slice(0,10):'';
  onChange(withMilestoneRanges(value,[...ranges,{start:date,end:date,description:'',notes:[],color:last.color||value.barColor||'red'}]));
 }
 return <fieldset className="milestone-ranges"><legend>Tarih Aralıkları</legend><p className="milestone-date-hint">Açıklama tarihleri ana barın başlangıç ve bitişini otomatik belirler. Ana bar tarihlerini ayrıca elle değiştirebilirsiniz.</p>
  <div className="milestone-range-list">{ranges.map((range,index)=>{const notes=rangeNotes(range);return <div className="milestone-range-row" key={index}>
   <span className="milestone-range-number">{index+1}</span>
   <div className="milestone-range-dates">
    <strong>Ana Bar Tarihleri</strong><div><label>Başlangıç Tarihi<input type="date" min={min} max={max} value={range.start} onChange={event=>updateRange(index,{start:event.target.value})}/></label>
    <label>Bitiş Tarihi<input type="date" min={min} max={max} value={range.end} onChange={event=>updateRange(index,{end:event.target.value})}/></label></div>
   </div>
   <div className="milestone-range-notes"><strong>Açıklamalar</strong>{notes.length===0&&<p className="milestone-note-empty">Bu tarih aralığında açıklama yok.</p>}{notes.map((note,noteIndex)=><div className="milestone-note-row" key={noteIndex}>
    <textarea rows={3} value={note.text} placeholder={`${noteIndex+1}. açıklama`} aria-label={`${index+1}. tarih aralığı ${noteIndex+1}. açıklama`} onChange={event=>updateNote(index,noteIndex,{text:event.target.value})}/>
    <div className="milestone-note-dates"><label>Başlangıç<input type="date" min={min} max={max} value={noteDates(note,range).start} aria-label={`${index+1}. tarih aralığı ${noteIndex+1}. açıklama başlangıç tarihi`} onChange={event=>updateNote(index,noteIndex,{start:event.target.value})}/></label><label>Bitiş<input type="date" min={min} max={max} value={noteDates(note,range).end} aria-label={`${index+1}. tarih aralığı ${noteIndex+1}. açıklama bitiş tarihi`} onChange={event=>updateNote(index,noteIndex,{end:event.target.value})}/></label><div className="milestone-note-flags"><label className="milestone-note-report"><input type="checkbox" checked={note.includeInReport} onChange={event=>updateNote(index,noteIndex,{includeInReport:event.target.checked})}/>Rapora Ekle</label><label className="milestone-note-complete"><input type="checkbox" checked={!!note.completed} onChange={event=>updateNote(index,noteIndex,{completed:event.target.checked})}/>Tamamlandı</label></div></div>
    <button type="button" className="milestone-note-remove" aria-label={`${noteIndex+1}. açıklamayı kaldır`} title="Açıklamayı kaldır" onClick={()=>onChange(removeMilestoneNote(value,index,noteIndex))}><Trash2 size={14}/></button>
   </div>)}<button type="button" className="milestone-note-add" disabled={notes.length>=10} onClick={()=>addNote(index)}><Plus size={13}/>Açıklama Ekle</button></div>
   <div className="milestone-range-colors" role="group" aria-label={`${index+1}. tarih aralığının bar rengi`}><span>Bar Rengi</span>{phasePalette.map(color=><button type="button" key={color.id} className={range.color===color.id?'selected':''} title={color.name} aria-label={color.name} aria-pressed={range.color===color.id} style={{'--range-color':color.border,'--range-soft':color.bg} as CSSProperties} onClick={()=>updateRange(index,{color:color.id})}/>)}</div>
   <button type="button" className="milestone-range-remove" aria-label={`${index+1}. tarih aralığını kaldır`} title={ranges.length===1?'Son tarih aralığını kaldırmak için bilgiyi silin':'Tarih aralığını kaldır'} disabled={ranges.length===1} onClick={()=>onChange(removeMilestoneRange(value,index))}><Trash2 size={15}/></button>
  </div>})}</div>
  <button type="button" className="button milestone-range-add" disabled={ranges.length>=20} onClick={addRange}><Plus size={14}/>Tarih Aralığı Ekle</button>
 </fieldset>;
}
