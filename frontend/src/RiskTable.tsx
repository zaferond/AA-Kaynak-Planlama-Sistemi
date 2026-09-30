import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import type {Risk} from './model';
import {riskAssessment} from './risk-score';
import {riskValidationError} from './risk-validation';

type Column={key:string;label:string;width:number;group:'record'|'initial'|'strategy'|'action'|'residual';text?:boolean;center?:boolean};
const columns:Column[]=[
 {key:'description',label:'Risk tanımı (kaynak · olay · sonuç)',width:310,group:'record',text:true},
 {key:'reportedBy',label:'Risk bildirimini yapan birim / sorumlu',width:210,group:'record',text:true},
 {key:'category',label:'Risk kategorisi',width:138,group:'record'},
 {key:'reportedAt',label:'Bildirim tarihi',width:132,group:'record'},
 {key:'system',label:'Sistem / alt sistem',width:175,group:'record',text:true},
 {key:'cause',label:'Potansiyel sebep',width:245,group:'record',text:true},
 {key:'actionPlan',label:'Aksiyon planı',width:260,group:'record',text:true},
 {key:'targetAt',label:'Hedef tarih',width:130,group:'record'},
 {key:'status',label:'Statü',width:122,group:'record'},
 {key:'owner',label:'Risk sorumlusu',width:175,group:'record',text:true},
 {key:'likelihood',label:'Olasılık',width:98,group:'initial',center:true},
 {key:'impact',label:'Etki',width:85,group:'initial',center:true},
 {key:'score',label:'Risk puanı',width:105,group:'initial',center:true},
 {key:'level',label:'Risk seviyesi',width:158,group:'initial',center:true},
 {key:'avoid',label:'Kaçınma',width:100,group:'strategy',center:true},
 {key:'control',label:'Kontrol',width:100,group:'strategy',center:true},
 {key:'accept',label:'Üstlenme–Kabul',width:132,group:'strategy',center:true},
 {key:'transfer',label:'Transfer',width:104,group:'strategy',center:true},
 {key:'implementedAt',label:'Aksiyonun devreye alınma tarihi',width:167,group:'action'},
 {key:'actionResult',label:'Gerçekleştirilen aksiyon & değerlendirme',width:260,group:'action',text:true},
 {key:'residualLikelihood',label:'Olasılık',width:98,group:'residual',center:true},
 {key:'residualImpact',label:'Etki',width:85,group:'residual',center:true},
 {key:'residualScore',label:'Aksiyon sonrası risk puanı',width:132,group:'residual',center:true},
 {key:'residualLevel',label:'Risk seviyesi',width:158,group:'residual',center:true},
];
const strategyKeys:Record<string,Risk['strategy']>={avoid:'Kaçınma',control:'Kontrol',accept:'Üstlenme-Kabul',transfer:'Transfer'};
const editableFields=new Set(['description','reportedBy','category','reportedAt','system','cause','actionPlan','targetAt','status','owner','likelihood','impact','implementedAt','actionResult','residualLikelihood','residualImpact']);
const categories:Risk['category'][]=['Takvim','Mali','Teknik','İdari'];
const statuses:Risk['status'][]=['Açık','Takipte','Kapalı'];
const dateFormat=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'});
function date(value:string){return value?<time dateTime={value}>{dateFormat.format(new Date(value+'T12:00:00'))}</time>:<span className="risk-dash">—</span>}
function text(value:string){return value?<span className="risk-wrap">{value}</span>:<span className="risk-dash">—</span>}
function levelCell(value:ReturnType<typeof riskAssessment>,scoreOnly=false){return value?<span className={'risk-grid-level risk-grid-'+value.className}>{scoreOnly?value.score:value.level}</span>:<span className="risk-dash">—</span>}
function cellContent(risk:Risk,column:Column,index:number):ReactNode{
 const initial=riskAssessment(risk.likelihood,risk.impact);
 const residual=riskAssessment(risk.residualLikelihood,risk.residualImpact);
 switch(column.key){
  case 'description':return <div className="risk-definition"><span className="risk-row-number">{String(index+1).padStart(2,'0')}</span><div><strong>{risk.description}</strong><small>Kaydeden: {risk.createdByName}</small></div></div>;
  case 'reportedBy':return text(risk.reportedBy);
  case 'category':return risk.category;
  case 'reportedAt':return date(risk.reportedAt);
  case 'system':return text(risk.system);
  case 'cause':return text(risk.cause);
  case 'actionPlan':return text(risk.actionPlan);
  case 'targetAt':return date(risk.targetAt);
  case 'status':return <span className={'risk-status risk-status-'+risk.status.toLowerCase()}>{risk.status}</span>;
  case 'owner':return text(risk.owner);
  case 'likelihood':return risk.likelihood;
  case 'impact':return risk.impact;
  case 'score':return levelCell(initial,true);
  case 'level':return levelCell(initial);
  case 'implementedAt':return date(risk.implementedAt);
  case 'actionResult':return text(risk.actionResult);
  case 'residualLikelihood':return risk.residualLikelihood??<span className="risk-dash">—</span>;
  case 'residualImpact':return risk.residualImpact??<span className="risk-dash">—</span>;
  case 'residualScore':return levelCell(residual,true);
  case 'residualLevel':return levelCell(residual);
  default:return <span className={risk.strategy===strategyKeys[column.key]?'risk-strategy-check':'risk-dash'}>{risk.strategy===strategyKeys[column.key]?'✓':'—'}</span>;
 }
}
export default function RiskTable({risks,projectId,createSignal,createRisk,canEdit,canDelete,onSave,onDelete}:{risks:Risk[];projectId:string;createSignal:number;createRisk:()=>Risk;canEdit:(risk:Risk)=>boolean;canDelete:boolean;onSave:(risk:Risk)=>Promise<void>;onDelete:(risk:Risk)=>Promise<void>}){
 const [draft,setDraft]=useState<Risk|null>(null);
 const [isNew,setIsNew]=useState(false);
 const [focusField,setFocusField]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const scrollRef=useRef<HTMLDivElement>(null);
 const width=columns.reduce((total,column)=>total+column.width,0);
 const rows=isNew&&draft?[...risks,draft]:risks;
 function revealNewRow(){requestAnimationFrame(()=>{const element=scrollRef.current;if(element){element.scrollLeft=0;element.scrollTop=element.scrollHeight}})}
 useEffect(()=>{
  if(!draft)return;
  const field=document.querySelector<HTMLElement>(`[data-risk-input="${focusField}"]`)||document.querySelector<HTMLElement>('[data-risk-input]');
  field?.focus();
 },[draft?.id,focusField]);
 useEffect(()=>{
  if(draft&&(draft.projectId!==projectId||(!isNew&&!risks.some(risk=>risk.id===draft.id)))){setDraft(null);setIsNew(false);setError('')}
 },[risks,draft?.id,projectId,isNew]);
 useEffect(()=>{
  if(!createSignal)return;
  if(isNew){revealNewRow();return}
  let active=true;
  void(async()=>{
   if(draft&&!await save())return;
   if(!active)return;
   setError('');setFocusField('description');setIsNew(true);setDraft(createRisk());
   revealNewRow();
  })();
  return()=>{active=false};
 },[createSignal]);
 const update=<K extends keyof Risk>(key:K,value:Risk[K])=>setDraft(old=>old?{...old,[key]:value}:old);
 async function activate(risk:Risk,key:string){
  if(saving||draft?.id===risk.id)return;
  if(draft&&!await save())return;
  setError('');setIsNew(false);setFocusField(editableFields.has(key)||strategyKeys[key]?key:'description');setDraft(structuredClone(risk));
 }
 async function save():Promise<boolean>{
  if(!draft||saving)return false;
  const validationError=riskValidationError(draft);
  if(validationError){setError(validationError);return false}
  const original=risks.find(risk=>risk.id===draft.id);
  if(!isNew&&original&&JSON.stringify(original)===JSON.stringify(draft)){setDraft(null);setError('');return true}
  setSaving(true);setError('');
  try{await onSave(draft);setDraft(null);setIsNew(false);return true}catch(caught){setError((caught as Error).message);return false}finally{setSaving(false)}
 }
 function cancel(){if(saving)return;setDraft(null);setIsNew(false);setError('')}
 async function remove(){
  if(!draft||!canDelete||saving||!confirm('“'+draft.description.slice(0,90)+'” risk kaydı silinsin mi?'))return;
  setSaving(true);setError('');
  try{await onDelete(draft);setDraft(null)}catch(caught){setError((caught as Error).message)}finally{setSaving(false)}
 }
 useEffect(()=>{
  if(!draft)return;
  const outside=(event:PointerEvent)=>{
   const row=document.querySelector('.risk-editing-row');
   if(row?.contains(event.target as Node))return;
   if(saving){event.preventDefault();event.stopPropagation();return}
   if((event.target as Element).closest('[data-risk-add]'))return;
   const nextRow=(event.target as Element).closest<HTMLTableRowElement>('tr[data-risk-id]');
   if(nextRow?.dataset.riskEditable==='true')return;
   const validationError=riskValidationError(draft);
   if(validationError){event.preventDefault();event.stopPropagation();setError(validationError);return}
   void save();
  };
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[draft,saving,risks,onSave]);
 function onRowKeyDown(event:KeyboardEvent<HTMLTableRowElement>){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel()}
  if((event.target as HTMLElement).closest('.risk-inline-delete,.risk-inline-cancel'))return;
  if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void save()}
 }
 function editor(column:Column,risk:Risk,index:number):ReactNode{
  const key=column.key;
  if(strategyKeys[key])return <button type="button" className={'risk-inline-strategy'+(risk.strategy===strategyKeys[key]?' selected':'')} data-risk-input={key} aria-label={column.label+' stratejisi'} aria-pressed={risk.strategy===strategyKeys[key]} onClick={()=>update('strategy',risk.strategy===strategyKeys[key]?'':strategyKeys[key])}>{risk.strategy===strategyKeys[key]?'✓':'Seç'}</button>;
  if(!editableFields.has(key))return cellContent(risk,column,index);
  if(key==='category')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk.category} onChange={event=>update('category',event.target.value as Risk['category'])}>{categories.map(value=><option key={value}>{value}</option>)}</select>;
  if(key==='status')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk.status} onChange={event=>update('status',event.target.value as Risk['status'])}>{statuses.map(value=><option key={value}>{value}</option>)}</select>;
  if(key==='likelihood'||key==='impact')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]} onChange={event=>update(key,Number(event.target.value))}><option value={0}>Seçin</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}</select>;
  if(key==='residualLikelihood'||key==='residualImpact')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]??''} onChange={event=>update(key,event.target.value?Number(event.target.value):null)}><option value="">—</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}</select>;
  if(key==='reportedAt'||key==='targetAt'||key==='implementedAt')return <input type="date" className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]} onChange={event=>update(key,event.target.value)}/>;
  if(key==='description'||key==='cause'||key==='actionPlan'||key==='actionResult')return <div>{key==='description'&&<div className="risk-edit-description-head"><span className="risk-row-number">{String(index+1).padStart(2,'0')}</span>{isNew&&<span className="risk-new-badge">YENİ RİSK</span>}</div>}<textarea className="risk-inline-input risk-inline-textarea" data-risk-input={key} aria-label={column.label} rows={3} maxLength={5000} value={risk[key]} onChange={event=>update(key,event.target.value)}/>{key==='description'&&(isNew?<button type="button" className="risk-inline-cancel" onClick={cancel}>Vazgeç</button>:canDelete&&<button type="button" className="risk-inline-delete" onClick={()=>void remove()}>Riski sil</button>)}</div>;
  if(key==='reportedBy'||key==='system'||key==='owner')return <input type="text" className="risk-inline-input" data-risk-input={key} aria-label={column.label} maxLength={200} value={risk[key]} onChange={event=>update(key,event.target.value)}/>;
  return null;
 }
 return <div className="risk-register">
  <div className="risk-register-head"><div><h3>Risk Kayıtları</h3><span>{risks.length} kayıt · 24 plan alanı{isNew?' · Yeni risk ekleniyor':''}</span></div><span className="risk-scroll-hint" role="status">{saving?'Kaydediliyor…':draft?'Enter veya satır dışına tıklayarak kaydedin · Shift+Enter yeni satır · Esc iptal':'Düzenlemek için hücreye tıklayın · Tüm sütunlar yatay kaydırılabilir'}</span></div>
  {error&&<div className="risk-inline-error" role="alert">{error}</div>}
  <div className="risk-table-scroll" ref={scrollRef} role="region" aria-label="Proje risk planı tablosu" tabIndex={0}>
   <table className="risk-table" style={{width}}>
    <colgroup>{columns.map(column=><col key={column.key} style={{width:column.width}}/>)}</colgroup>
    <thead><tr className="risk-group-head"><th colSpan={10}>Risk Bildirimi ve Aksiyon Planı</th><th colSpan={4}>İlk Risk Değerlendirmesi</th><th colSpan={4}>Risk Stratejisi</th><th colSpan={2}>Uygulanan Aksiyon</th><th colSpan={4}>Aksiyon Sonrası Değerlendirme</th></tr><tr className="risk-column-head">{columns.map(column=><th key={column.key} className={'risk-head-'+column.group+(column.center?' risk-center':'')}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.length?rows.map((risk,index)=>{const editing=draft?.id===risk.id,display=editing?draft:risk,editable=(isNew&&editing)||canEdit(risk);return <tr key={risk.id} data-risk-id={risk.id} data-risk-editable={editable} className={[editing?'risk-editing-row':'',isNew&&editing?'risk-new-row':''].filter(Boolean).join(' ')} onKeyDown={editing?onRowKeyDown:undefined} onClick={!editing&&editable?event=>{const key=(event.target as HTMLElement).closest<HTMLTableCellElement>('td[data-risk-column]')?.dataset.riskColumn||'description';void activate(risk,key)}:undefined}>{columns.map(column=><td key={column.key} data-risk-column={column.key} className={['risk-cell','risk-cell-'+column.group,column.text?'risk-text-cell':'',column.center?'risk-center':'',column.key==='score'||column.key==='level'||column.key==='residualScore'||column.key==='residualLevel'?'risk-assessment-cell':'',editing?'risk-cell-editing':''].filter(Boolean).join(' ')}>{editing?editor(column,display,index):editable?<button type="button" className="risk-cell-trigger" title="Satırda düzenle" aria-label={column.label+' alanını satırda düzenle'} disabled={saving}>{cellContent(risk,column,index)}</button>:cellContent(risk,column,index)}</td>)}</tr>}):<tr className="risk-empty-row"><td colSpan={columns.length}>Bu proje için henüz risk kaydı yok. İlk kaydı oluşturmak için Risk Ekle’yi kullanın.</td></tr>}</tbody>
   </table>
  </div>
 </div>
}
