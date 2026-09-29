import {Pencil} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Risk} from './model';
import {riskAssessment} from './risk-score';

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
export default function RiskTable({risks,canEdit,onEdit}:{risks:Risk[];canEdit:(risk:Risk)=>boolean;onEdit:(risk:Risk)=>void}){
 const width=columns.reduce((total,column)=>total+column.width,0)+76;
 return <div className="risk-register">
  <div className="risk-register-head"><div><h3>Risk Kayıtları</h3><span>{risks.length} kayıt · 24 plan alanı</span></div><span className="risk-scroll-hint">Tüm sütunları görmek için tabloyu yatay kaydırın</span></div>
  <div className="risk-table-scroll" role="region" aria-label="Proje risk planı tablosu" tabIndex={0}>
   <table className="risk-table" style={{width}}>
    <colgroup>{columns.map(column=><col key={column.key} style={{width:column.width}}/>)}<col style={{width:76}}/></colgroup>
    <thead><tr className="risk-group-head"><th rowSpan={2} className="risk-sticky-first">Risk Tanımı</th><th colSpan={9}>Risk Bildirimi ve Aksiyon Planı</th><th colSpan={4}>İlk Risk Değerlendirmesi</th><th colSpan={4}>Risk Stratejisi</th><th colSpan={2}>Uygulanan Aksiyon</th><th colSpan={4}>Aksiyon Sonrası Değerlendirme</th><th rowSpan={2} className="risk-sticky-last">İşlem</th></tr><tr className="risk-column-head">{columns.slice(1).map(column=><th key={column.key} className={'risk-head-'+column.group+(column.center?' risk-center':'')}>{column.label}</th>)}</tr></thead>
    <tbody>{risks.length?risks.map((risk,index)=><tr key={risk.id}>{columns.map((column,i)=><td key={column.key} className={['risk-cell','risk-cell-'+column.group,column.text?'risk-text-cell':'',column.center?'risk-center':'',i===0?'risk-sticky-first':'',column.key==='score'||column.key==='level'||column.key==='residualScore'||column.key==='residualLevel'?'risk-assessment-cell':''].filter(Boolean).join(' ')}>{cellContent(risk,column,index)}</td>)}<td className="risk-sticky-last risk-edit-cell">{canEdit(risk)?<button type="button" title="Riski düzenle" aria-label={risk.description+' riskini düzenle'} onClick={()=>onEdit(risk)}><Pencil size={16}/></button>:<span className="risk-dash">—</span>}</td></tr>):<tr className="risk-empty-row"><td colSpan={columns.length+1}>Bu proje için henüz risk kaydı yok. İlk kaydı oluşturmak için Risk Ekle’yi kullanın.</td></tr>}</tbody>
   </table>
  </div>
 </div>
}
