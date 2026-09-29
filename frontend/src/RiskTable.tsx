import {Check,Pencil,X} from 'lucide-react';
import {useEffect,useState,type KeyboardEvent,type ReactNode} from 'react';
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
export default function RiskTable({risks,canEdit,onEdit,onSave}:{risks:Risk[];canEdit:(risk:Risk)=>boolean;onEdit:(risk:Risk)=>void;onSave:(risk:Risk)=>Promise<void>}){
 const [draft,setDraft]=useState<Risk|null>(null);
 const [focusField,setFocusField]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const width=columns.reduce((total,column)=>total+column.width,0)+76;
 useEffect(()=>{
  if(!draft)return;
  const field=document.querySelector<HTMLElement>(`[data-risk-input="${focusField}"]`)||document.querySelector<HTMLElement>('[data-risk-input]');
  field?.focus();
 },[draft?.id,focusField]);
 useEffect(()=>{
  if(draft&&!risks.some(risk=>risk.id===draft.id)){setDraft(null);setError('')}
 },[risks,draft?.id]);
 const update=<K extends keyof Risk>(key:K,value:Risk[K])=>setDraft(old=>old?{...old,[key]:value}:old);
 function begin(risk:Risk,key:string){
  if(saving||draft)return;
  setError('');setFocusField(editableFields.has(key)||strategyKeys[key]?key:'description');setDraft(structuredClone(risk));
 }
 async function save(){
  if(!draft||saving)return;
  const validationError=riskValidationError(draft);
  if(validationError){setError(validationError);return}
  const original=risks.find(risk=>risk.id===draft.id);
  if(original&&JSON.stringify(original)===JSON.stringify(draft)){setDraft(null);setError('');return}
  setSaving(true);setError('');
  try{await onSave(draft);setDraft(null)}catch(caught){setError((caught as Error).message)}finally{setSaving(false)}
 }
 function cancel(){if(saving)return;setDraft(null);setError('')}
 function onRowKeyDown(event:KeyboardEvent<HTMLTableRowElement>){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel()}
  if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void save()}
 }
 function editor(column:Column,risk:Risk,index:number):ReactNode{
  const key=column.key;
  if(strategyKeys[key])return <button type="button" className={'risk-inline-strategy'+(risk.strategy===strategyKeys[key]?' selected':'')} data-risk-input={key} aria-label={column.label+' stratejisi'} aria-pressed={risk.strategy===strategyKeys[key]} onClick={()=>update('strategy',risk.strategy===strategyKeys[key]?'':strategyKeys[key])}>{risk.strategy===strategyKeys[key]?'✓':'Seç'}</button>;
  if(!editableFields.has(key))return cellContent(risk,column,index);
  if(key==='category')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk.category} onChange={event=>update('category',event.target.value as Risk['category'])}>{categories.map(value=><option key={value}>{value}</option>)}</select>;
  if(key==='status')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk.status} onChange={event=>update('status',event.target.value as Risk['status'])}>{statuses.map(value=><option key={value}>{value}</option>)}</select>;
  if(key==='likelihood'||key==='impact')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]} onChange={event=>update(key,Number(event.target.value))}>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}</select>;
  if(key==='residualLikelihood'||key==='residualImpact')return <select className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]??''} onChange={event=>update(key,event.target.value?Number(event.target.value):null)}><option value="">—</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}</select>;
  if(key==='reportedAt'||key==='targetAt'||key==='implementedAt')return <input type="date" className="risk-inline-input" data-risk-input={key} aria-label={column.label} value={risk[key]} onChange={event=>update(key,event.target.value)}/>;
  if(key==='description'||key==='cause'||key==='actionPlan'||key==='actionResult')return <textarea className="risk-inline-input risk-inline-textarea" data-risk-input={key} aria-label={column.label} rows={3} maxLength={5000} value={risk[key]} onChange={event=>update(key,event.target.value)}/>;
  if(key==='reportedBy'||key==='system'||key==='owner')return <input type="text" className="risk-inline-input" data-risk-input={key} aria-label={column.label} maxLength={200} value={risk[key]} onChange={event=>update(key,event.target.value)}/>;
  return null;
 }
 return <div className="risk-register">
  <div className="risk-register-head"><div><h3>Risk Kayıtları</h3><span>{risks.length} kayıt · 24 plan alanı</span></div><span className="risk-scroll-hint">{draft?'Satırda düzenleyin · Ctrl+Enter ile kaydedin · Esc ile vazgeçin':'Düzenlemek için hücreye tıklayın · Tüm sütunlar yatay kaydırılabilir'}</span></div>
  {error&&<div className="risk-inline-error" role="alert">{error}</div>}
  <div className="risk-table-scroll" role="region" aria-label="Proje risk planı tablosu" tabIndex={0}>
   <table className="risk-table" style={{width}}>
    <colgroup>{columns.map(column=><col key={column.key} style={{width:column.width}}/>)}<col style={{width:76}}/></colgroup>
    <thead><tr className="risk-group-head"><th rowSpan={2} className="risk-sticky-first">Risk Tanımı</th><th colSpan={9}>Risk Bildirimi ve Aksiyon Planı</th><th colSpan={4}>İlk Risk Değerlendirmesi</th><th colSpan={4}>Risk Stratejisi</th><th colSpan={2}>Uygulanan Aksiyon</th><th colSpan={4}>Aksiyon Sonrası Değerlendirme</th><th rowSpan={2} className="risk-sticky-last">İşlem</th></tr><tr className="risk-column-head">{columns.slice(1).map(column=><th key={column.key} className={'risk-head-'+column.group+(column.center?' risk-center':'')}>{column.label}</th>)}</tr></thead>
    <tbody>{risks.length?risks.map((risk,index)=>{const editing=draft?.id===risk.id,display=editing?draft:risk,editable=canEdit(risk);return <tr key={risk.id} className={editing?'risk-editing-row':''} onKeyDown={editing?onRowKeyDown:undefined}>{columns.map((column,i)=><td key={column.key} className={['risk-cell','risk-cell-'+column.group,column.text?'risk-text-cell':'',column.center?'risk-center':'',i===0?'risk-sticky-first':'',column.key==='score'||column.key==='level'||column.key==='residualScore'||column.key==='residualLevel'?'risk-assessment-cell':'',editing?'risk-cell-editing':''].filter(Boolean).join(' ')}>{editing?editor(column,display,index):editable?<button type="button" className="risk-cell-trigger" title="Satırda düzenle" aria-label={column.label+' alanını satırda düzenle'} disabled={!!draft||saving} onClick={()=>begin(risk,column.key)}>{cellContent(risk,column,index)}</button>:cellContent(risk,column,index)}</td>)}<td className="risk-sticky-last risk-edit-cell">{editing?<div className="risk-edit-actions"><button type="button" className="risk-save-cell" title="Satırı kaydet" aria-label="Satırı kaydet" disabled={saving} onClick={()=>void save()}><Check size={16}/></button><button type="button" title="Düzenlemeden vazgeç" aria-label="Düzenlemeden vazgeç" disabled={saving} onClick={cancel}><X size={16}/></button></div>:editable?<button type="button" title="Riski ayrıntılı düzenle" aria-label={risk.description+' riskini ayrıntılı düzenle'} disabled={!!draft||saving} onClick={()=>onEdit(risk)}><Pencil size={16}/></button>:<span className="risk-dash">—</span>}</td></tr>}):<tr className="risk-empty-row"><td colSpan={columns.length+1}>Bu proje için henüz risk kaydı yok. İlk kaydı oluşturmak için Risk Ekle’yi kullanın.</td></tr>}</tbody>
   </table>
  </div>
 </div>
}
