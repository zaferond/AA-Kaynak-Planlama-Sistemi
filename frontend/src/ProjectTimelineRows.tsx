import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,MouseEvent,PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Pencil,Plus,Trash2} from 'lucide-react';
import {Tooltip} from 'radix-ui';
import {TableRow,TableCell} from '@/components/ui/table';
import type {Milestone,Project} from './model';
import {phasePalette,phaseStyle} from './model';
import ProjectResponsible from './ProjectResponsible';
import {milestoneRanges,noteDates,rangeNotes,resizeMilestoneRange,shiftCalendarDate,shiftMilestoneRange,visibleMilestoneBarStyle} from './milestone-ranges';
import {calendarDayDifference,dateAtTrackPosition,milestoneBars} from './milestone-bars';

const monthFormat=new Intl.DateTimeFormat('tr-TR',{month:'short',year:'numeric'});
const monthLabel=(month:string)=>monthFormat.format(new Date(month+'-01T12:00:00'));
const dateFormat=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',year:'numeric'});
const dateLabel=(date:string)=>dateFormat.format(new Date(date+'T12:00:00'));
const barDateFormat=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'});
const barDateLabel=(date:string)=>barDateFormat.format(new Date(date+'T12:00:00'));

type Props={
 project:Project;
 months:string[];
 density:'detail'|'compact'|'overview';
 expandAllDetails:boolean;
 isAdmin:boolean;
 saving:boolean;
 onProjectInfo:()=>void;
 onPhaseClick:(month:string)=>void;
 onPhaseContextMenu:(event:MouseEvent<HTMLButtonElement>,month:string)=>void;
 onAddMilestone:()=>void;
 onEditMilestone:(milestone:Milestone)=>void;
 onDeleteMilestone:(milestone:Milestone)=>void;
 onMilestoneContextMenu:(event:MouseEvent<HTMLButtonElement>,milestone:Milestone,rangeIndex:number)=>void;
 onChangeMilestoneRange:(milestone:Milestone,rangeIndex:number,mode:'move'|'start'|'end',days:number)=>Promise<void>;
};

type MilestoneTrackProps=Pick<Props,'isAdmin'|'saving'|'onEditMilestone'|'onMilestoneContextMenu'|'onChangeMilestoneRange'> & {
 project:Project;
 milestone:Milestone;
 ranges:ReturnType<typeof milestoneRanges>;
 bars:ReturnType<typeof milestoneBars>;
 months:string[];
};

type DragMode='move'|'start'|'end';
type DragState={pointerId:number;rangeIndex:number;mode:DragMode;startX:number;startDate:string;timer:ReturnType<typeof setTimeout>|null;active:boolean;cancelled:boolean;moved:boolean;days:number};
type DragPreview={rangeIndex:number;mode:DragMode;days:number;start:string;end:string;message:string;x:number;y:number};

function MilestoneTrack({project,milestone,ranges,bars,months,isAdmin,saving,onEditMilestone,onMilestoneContextMenu,onChangeMilestoneRange}:MilestoneTrackProps){
 const trackRef=useRef<HTMLDivElement>(null);
 const dragRef=useRef<DragState|null>(null);
 const suppressClickRef=useRef(false);
 const [trackHeight,setTrackHeight]=useState(36);
 const [dragging,setDragging]=useState(false);
 const [preview,setPreview]=useState<DragPreview|null>(null);

 useEffect(()=>()=>{if(dragRef.current?.timer)clearTimeout(dragRef.current.timer)},[]);

 function beginDrag(event:PointerEvent<HTMLElement>,rangeIndex:number,mode:DragMode){
  if(!isAdmin||saving||event.pointerType!=='mouse'||event.button!==0||!trackRef.current)return;
  const rect=trackRef.current.getBoundingClientRect();
  const startDate=dateAtTrackPosition(event.clientX,rect.left,rect.width,months);
  const range=ranges[rangeIndex];
  const drag:DragState={pointerId:event.pointerId,rangeIndex,mode,startX:event.clientX,startDate,timer:null,active:mode!=='move',cancelled:false,moved:false,days:0};
  if(mode==='move')drag.timer=setTimeout(()=>{if(dragRef.current!==drag||drag.cancelled)return;drag.active=true;setDragging(true);setPreview({rangeIndex,mode,days:0,start:range.start,end:range.end,message:'',x:event.clientX,y:event.clientY})},350);
  else{setDragging(true);setPreview({rangeIndex,mode,days:0,start:range.start,end:range.end,message:'',x:event.clientX,y:event.clientY})}
  dragRef.current=drag;
  event.currentTarget.setPointerCapture(event.pointerId);
 }

 function moveDrag(event:PointerEvent<HTMLElement>){
  const drag=dragRef.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(!drag.active){
   if(Math.abs(event.clientX-drag.startX)>6){if(drag.timer)clearTimeout(drag.timer);drag.timer=null;drag.cancelled=true;drag.moved=true}
   return;
  }
  const rect=trackRef.current?.getBoundingClientRect();
  if(!rect)return;
  const date=dateAtTrackPosition(event.clientX,rect.left,rect.width,months);
  const days=calendarDayDifference(drag.startDate,date);
  drag.days=days;
  if(days)drag.moved=true;
  const range=ranges[drag.rangeIndex];
  const start=drag.mode==='end'?range.start:shiftCalendarDate(range.start,days);
  const end=drag.mode==='start'?range.end:shiftCalendarDate(range.end,days);
  try{
   if(drag.mode==='move')shiftMilestoneRange(project,milestone,drag.rangeIndex,days);
   else resizeMilestoneRange(project,milestone,drag.rangeIndex,drag.mode,days);
   setPreview({rangeIndex:drag.rangeIndex,mode:drag.mode,days,start,end,message:'',x:event.clientX,y:event.clientY});
  }catch(error){
   setPreview(current=>({rangeIndex:drag.rangeIndex,mode:drag.mode,days:current?.days||0,start,end,message:(error as Error).message,x:event.clientX,y:event.clientY}));
  }
 }

 function endDrag(event:PointerEvent<HTMLElement>){
  const drag=dragRef.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(drag.timer)clearTimeout(drag.timer);
  if(drag.moved){suppressClickRef.current=true;setTimeout(()=>{suppressClickRef.current=false},0)}
  if(drag.active&&drag.days!==0)void onChangeMilestoneRange(milestone,drag.rangeIndex,drag.mode,drag.days);
  dragRef.current=null;
  setDragging(false);
  setPreview(null);
 }

 function cancelDrag(event:PointerEvent<HTMLElement>){
  const drag=dragRef.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(drag.timer)clearTimeout(drag.timer);
  dragRef.current=null;
  setDragging(false);
  setPreview(null);
 }

 useLayoutEffect(()=>{
  const barElements=Array.from(trackRef.current?.querySelectorAll<HTMLButtonElement>('.gantt-bar')||[]);
  const updateHeight=()=>{
   const nextHeight=Math.max(36,...barElements.map(bar=>bar.offsetHeight+12));
   setTrackHeight(current=>current===nextHeight?current:nextHeight);
  };
  const observer=new ResizeObserver(updateHeight);
  barElements.forEach(bar=>observer.observe(bar));
  updateHeight();
  return ()=>observer.disconnect();
 },[bars]);

 const defaultColor=phasePalette.find(item=>item.id===(milestone.barColor||'red'))||phasePalette[3];
 return <div ref={trackRef} className="milestone-track" style={{'--milestone-month-width':100/months.length+'%',height:trackHeight} as CSSProperties}>{bars.map((bar,index)=>{
  const rangeIndex=ranges.indexOf(bar.range);
  const changed=preview?.rangeIndex===rangeIndex&&preview.days?(preview.mode==='move'?shiftMilestoneRange(project,milestone,rangeIndex,preview.days):resizeMilestoneRange(project,milestone,rangeIndex,preview.mode,preview.days)):null;
  const displayed=changed?milestoneBars([milestoneRanges(changed)[rangeIndex]],months)[0]||bar:bar;
  const notes=rangeNotes(displayed.range).filter(note=>note.text.trim());
  const entries=notes.length?notes.map(note=>({text:note.text,completed:!!note.completed,...noteDates(note,displayed.range)})):[{text:milestone.name,completed:false,start:displayed.range.start,end:displayed.range.end}];
  const details=entries.map(entry=>'• '+(entry.completed?'Tamamlandı: ':'')+entry.text+' · '+dateLabel(entry.start)+' – '+dateLabel(entry.end));
  const barColor=phasePalette.find(item=>item.id===bar.range.color)||defaultColor;
  const barStyle={'--gantt-color':barColor.ink,'--gantt-soft':barColor.bg,'--gantt-ink':barColor.ink,left:displayed.left+'%',width:displayed.width+'%'} as CSSProperties;
  return <button type="button" key={index} className={'gantt-bar start end '+visibleMilestoneBarStyle(milestone.barStyle)+(isAdmin?' editable':'')+(dragging&&preview?.rangeIndex===rangeIndex?' dragging':'')} style={barStyle} title={`${milestone.name} · ${dateLabel(displayed.range.start)} – ${dateLabel(displayed.range.end)}\n${details.join('\n')}${isAdmin?'\nTıklayın: düzenle · Basılı tutup sürükleyin: taşı · Uçlardan sürükleyin: daralt / genişlet':''}`} aria-label={details.join(', ')} onClick={()=>{if(suppressClickRef.current){suppressClickRef.current=false;return}if(isAdmin&&!saving)onEditMilestone(milestone)}} onPointerDown={event=>beginDrag(event,rangeIndex,'move')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onContextMenu={event=>onMilestoneContextMenu(event,milestone,rangeIndex)}><ul className="gantt-note-list">{entries.map((entry,noteIndex)=><li key={noteIndex} className={entry.completed?'completed':undefined}><strong className="gantt-note-text">{entry.text}</strong><small className="gantt-note-dates"><time dateTime={entry.start}>{barDateLabel(entry.start)}</time> – <time dateTime={entry.end}>{barDateLabel(entry.end)}</time></small></li>)}</ul>{isAdmin&&(['start','end'] as const).map(edge=><span key={edge} className={'gantt-resize-handle '+edge} role="presentation" title={edge==='start'?'Başlangıç tarihini sürükleyin':'Bitiş tarihini sürükleyin'} onPointerDown={event=>{event.stopPropagation();beginDrag(event,rangeIndex,edge)}} onPointerMove={event=>{event.stopPropagation();moveDrag(event)}} onPointerUp={event=>{event.stopPropagation();endDrag(event)}} onPointerCancel={event=>{event.stopPropagation();cancelDrag(event)}} onClick={event=>event.stopPropagation()}/>)}</button>;
 })}{preview&&createPortal(<div className={'gantt-drag-status'+(preview.message?' invalid':'')} role="status" style={{left:Math.max(8,Math.min(preview.x-105,window.innerWidth-222)),top:Math.max(8,preview.y-94)}}><strong>{preview.mode==='move'?'Taşınıyor':preview.mode==='start'?'Başlangıç ayarlanıyor':'Bitiş ayarlanıyor'} <span>{preview.days>0?'+':''}{preview.days} gün</span></strong><div><span><small>Başlangıç</small>{dateLabel(preview.start)}</span><span><small>Bitiş</small>{dateLabel(preview.end)}</span></div>{preview.message?<p>{preview.message}</p>:<em>{calendarDayDifference(preview.start,preview.end)+1} gün sürer</em>}</div>,document.body)}</div>;
}

export default function ProjectTimelineRows({project,months,density,expandAllDetails,isAdmin,saving,onProjectInfo,onPhaseClick,onPhaseContextMenu,onAddMilestone,onEditMilestone,onDeleteMilestone,onMilestoneContextMenu,onChangeMilestoneRange}:Props){
 const [expanded,setExpanded]=useState(expandAllDetails);
 useLayoutEffect(()=>setExpanded(expandAllDetails),[expandAllDetails]);
 const milestones=[...(project.milestones||[])].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.name.localeCompare(b.name,'tr'));
 return <Tooltip.Provider delayDuration={180} skipDelayDuration={100}>
  <TableRow className="project-main-row">
   <TableCell><div className="project-name-cell"><button type="button" className="project-expand" aria-label={project.name+' kritik konularını '+(expanded?'gizle':'göster')} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?<ChevronDown size={14}/>:<Plus size={14}/>}</button><div className="project-name-copy"><button className="textbutton" disabled={!isAdmin} onClick={onProjectInfo}>{project.name}</button><ProjectResponsible project={project}/><small>{project.start} → {project.end}</small></div>{milestones.length>0&&<span className="milestone-count" title={milestones.length+' kritik konu'}>{milestones.length}</span>}</div></TableCell>
   {months.map(month=>{const phaseText=month>=project.start&&month<=project.end?project.phases[month]?.trim():'';const button=<button className="phasebutton" disabled={month<project.start||month>project.end} style={phaseStyle(project,month)} aria-label={project.name+' / '+monthLabel(month)+' aşama ayrıntısı'} onContextMenu={event=>onPhaseContextMenu(event,month)} onClick={()=>onPhaseClick(month)}><span className="phasepreview">{month<project.start||month>project.end?'-':density==='overview'?(phaseText?'●':'-'):phaseText||'-'}</span></button>;return <TableCell key={month}>{phaseText?<Tooltip.Root><Tooltip.Trigger asChild>{button}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="project-phase-tooltip" side="top" sideOffset={8} collisionPadding={12}>{phaseText}<Tooltip.Arrow className="project-phase-tooltip-arrow" width={10} height={5}/></Tooltip.Content></Tooltip.Portal></Tooltip.Root>:button}</TableCell>})}
  </TableRow>
  {expanded&&<>
   {isAdmin&&<TableRow className="milestone-section-row"><TableCell colSpan={months.length+1}><div className="milestone-section"><button type="button" className="button milestone-add" disabled={saving} onClick={onAddMilestone}><Plus size={14}/>Kritik Konu Ekle</button></div></TableCell></TableRow>}
   {milestones.map(milestone=>{
    const ranges=milestoneRanges(milestone);
    const bars=milestoneBars(ranges,months);
    const color=phasePalette.find(item=>item.id===(milestone.barColor||'red'))||phasePalette[3];
    return <TableRow className="milestone-row" key={milestone.id}>
     <TableCell><div className="milestone-name-cell"><span className="milestone-symbol" aria-hidden="true" style={{borderColor:color.border}}/><div className="milestone-name-copy"><strong title={milestone.name}>{milestone.name}</strong><small title={ranges.map(range=>dateLabel(range.start)+' – '+dateLabel(range.end)).join('\n')}>{ranges.length===0?'Kritik detay konu eklenmedi':ranges.length===1?dateLabel(ranges[0].start)+' – '+dateLabel(ranges[0].end):ranges.length+' tarih aralığı'}</small></div>{isAdmin&&<div className="milestone-actions"><button type="button" title="Kritik Konu Düzenle" aria-label={milestone.name+' düzenle'} disabled={saving} onClick={()=>onEditMilestone(milestone)}><Pencil size={13}/></button><button type="button" title="Kritik Konuyu Sil" aria-label={milestone.name+' sil'} disabled={saving} onClick={()=>onDeleteMilestone(milestone)}><Trash2 size={13}/></button></div>}</div></TableCell>
     <TableCell colSpan={months.length} className="milestone-month milestone-track-cell">{ranges.length?<MilestoneTrack project={project} milestone={milestone} ranges={ranges} bars={bars} months={months} isAdmin={isAdmin} saving={saving} onEditMilestone={onEditMilestone} onMilestoneContextMenu={onMilestoneContextMenu} onChangeMilestoneRange={onChangeMilestoneRange}/>:<div className="milestone-track milestone-track-empty">Kritik detay konu eklenmedi</div>}</TableCell>
    </TableRow>;
   })}
  </>}
 </Tooltip.Provider>;
}
