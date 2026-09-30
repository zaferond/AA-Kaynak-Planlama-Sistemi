import {ArrowRight,Plus,Trash2} from 'lucide-react';
import type {CSSProperties} from 'react';
import {phasePalette} from './model';
import type {Milestone,MilestoneNote,MilestoneRange} from './model';
import {addDraftMilestoneRange,addMilestoneNote,datedNotes,milestoneRanges,noteDates,rangeNotes,rangeWithNoteDates,removeDraftMilestoneRange,removeMilestoneNote,withMilestoneRanges} from './milestone-ranges';

type Props={value:Milestone;isEmpty:boolean;projectStart:string;projectEnd:string;onChange:(value:Milestone,isEmpty?:boolean)=>void};
const endAfterStart=(start:string,end:string)=>end>start?end:start;
export default function MilestoneDateEditor({value,isEmpty,projectStart,projectEnd,onChange}:Props){
 const ranges=isEmpty?[]:milestoneRanges(value);
 const min=projectStart+'-01';
 const max=new Date(Date.UTC(Number(projectEnd.slice(0,4)),Number(projectEnd.slice(5,7)),0)).toISOString().slice(0,10);
 function updateRange(index:number,changes:Partial<MilestoneRange>){
  onChange(withMilestoneRanges(value,ranges.map((range,i)=>i===index?{...range,...(('start' in changes||'end' in changes)?{notes:rangeNotes(range).map(note=>note.text.trim()?{...note,...noteDates(note,range)}:note)}:{}),...changes}:range)));
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
  onChange(addDraftMilestoneRange(value,projectEnd,isEmpty),false);
 }
 return <fieldset className="milestone-ranges"><legend>Kritik Detay Konular</legend><p className="milestone-date-hint">Detay açıklama tarihleri üstteki tarih aralığını otomatik belirler. Üstteki tarihleri ayrıca elle değiştirebilirsiniz.</p>
  {isEmpty&&<p className="milestone-range-empty">Henüz kritik detay konu eklenmedi. İlk konuyu aşağıdaki düğmeyle ekleyin.</p>}
  <div className="milestone-range-list">{ranges.map((range,index)=>{const notes=rangeNotes(range);return <div className="milestone-range-row" key={index}>
   <span className="milestone-range-number">{index+1}</span>
   <div className="milestone-range-dates">
    <strong>Açıklama</strong><div className="milestone-range-date-card"><label>Başlangıç Tarihi<input type="date" min={min} max={max} value={range.start} onChange={event=>updateRange(index,{start:event.target.value,end:endAfterStart(event.target.value,range.end)})}/></label>
    <span className="milestone-range-date-arrow" aria-hidden="true"><ArrowRight size={16}/></span>
    <label>Bitiş Tarihi<input type="date" min={range.start||min} max={max} value={range.end} onChange={event=>updateRange(index,{end:event.target.value})}/></label></div>
   </div>
   <div className="milestone-range-notes"><strong>Detay Açıklamalar</strong>{notes.length===0&&<p className="milestone-note-empty">Bu tarih aralığında açıklama yok.</p>}{notes.map((note,noteIndex)=><div className="milestone-note-row" key={noteIndex}>
    <label className="milestone-note-input"><span className="milestone-note-number">{index+1}.{noteIndex+1} Açıklama</span><textarea rows={3} value={note.text} placeholder="Açıklama yazın" onChange={event=>updateNote(index,noteIndex,{text:event.target.value})}/></label>
    <div className="milestone-note-dates"><label>Başlangıç<input type="date" min={min} max={max} value={noteDates(note,range).start} aria-label={`${index+1}.${noteIndex+1} açıklama başlangıç tarihi`} onChange={event=>updateNote(index,noteIndex,{start:event.target.value,end:endAfterStart(event.target.value,noteDates(note,range).end)})}/></label><label>Bitiş<input type="date" min={noteDates(note,range).start||min} max={max} value={noteDates(note,range).end} aria-label={`${index+1}.${noteIndex+1} açıklama bitiş tarihi`} onChange={event=>updateNote(index,noteIndex,{end:event.target.value})}/></label><div className="milestone-note-flags"><label className="milestone-note-report"><input type="checkbox" checked={note.includeInReport} onChange={event=>updateNote(index,noteIndex,{includeInReport:event.target.checked})}/>Rapora Ekle</label><label className="milestone-note-complete"><input type="checkbox" checked={!!note.completed} onChange={event=>updateNote(index,noteIndex,{completed:event.target.checked})}/>Tamamlandı</label></div></div>
    <button type="button" className="milestone-note-remove" aria-label={`${index+1}.${noteIndex+1} açıklamayı kaldır`} title="Açıklamayı kaldır" onClick={()=>onChange(removeMilestoneNote(value,index,noteIndex))}><Trash2 size={14}/></button>
   </div>)}<button type="button" className="milestone-note-add" disabled={notes.length>=10} onClick={()=>addNote(index)}><Plus size={13}/>Detay Not Ekle</button></div>
   <div className="milestone-range-colors" role="group" aria-label={`${index+1}. tarih aralığının bar rengi`}><span>Bar Rengi</span>{phasePalette.map(color=><button type="button" key={color.id} className={range.color===color.id?'selected':''} title={color.name} aria-label={color.name} aria-pressed={range.color===color.id} style={{'--range-color':color.border,'--range-soft':color.bg} as CSSProperties} onClick={()=>updateRange(index,{color:color.id})}/>)}</div>
   <button type="button" className="milestone-range-remove" aria-label={`${index+1}. kritik detay konuyu kaldır`} title="Kritik detay konuyu kaldır" onClick={()=>{const removed=removeDraftMilestoneRange(value,index);onChange(removed.value,removed.isEmpty)}}><Trash2 size={15}/></button>
  </div>})}</div>
  <button type="button" className="button milestone-range-add" disabled={ranges.length>=20} onClick={addRange}><Plus size={14}/>Not Ekle</button>
 </fieldset>;
}
