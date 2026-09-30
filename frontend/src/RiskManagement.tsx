import {useState,type ReactNode} from 'react';
import {Plus,ShieldAlert,Download} from 'lucide-react';
import type {Data,Risk} from './model';
import type {Principal} from './access';
import {riskAssessment} from './risk-score';
import {riskCreationOrder} from './risk-order';
import RiskTable from './RiskTable';
import {downloadRiskPlan} from './risk-export';
import './risk.css';

const likelihoodNames=['Çok Küçük','Küçük','Orta Derece','Yüksek','Çok Yüksek'];
const impactNames=['Çok Hafif','Hafif','Orta Derece','Ciddi','Çok Ciddi'];
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
function blank(projectId:string,user:Principal):Risk{return {id:crypto.randomUUID(),projectId,reportedBy:user.name,category:'Teknik',reportedAt:today(),system:'',description:'',cause:'',actionPlan:'',targetAt:'',status:'Açık',owner:'',likelihood:0,impact:0,strategy:'',implementedAt:'',actionResult:'',residualLikelihood:null,residualImpact:null,createdBy:user.id,createdByName:user.name,createdAt:'',updatedAt:''}}
function Score({likelihood,impact}:{likelihood:number|null;impact:number|null}){const result=riskAssessment(likelihood,impact);return result?<span className={'risk-score risk-'+result.className}><strong>{result.score}</strong><small>{result.level}</small></span>:<span className="risk-score risk-empty">Değerlendirilmedi</span>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="risk-field"><span>{label}</span>{children}</label>}
export default function RiskManagement({data,user,onSave,onDelete}:{data:Data;user:Principal;onSave:(risk:Risk)=>Promise<void>;onDelete:(risk:Risk)=>Promise<void>}){
 const [projectId,setProjectId]=useState(''),[createSignal,setCreateSignal]=useState(0),[exportError,setExportError]=useState('');
 const project=data.projects.find(item=>item.id===projectId);
 const risks=riskCreationOrder((data.risks||[]).filter(item=>item.projectId===projectId));
 const canEdit=(risk:Risk)=>user.role==='admin'||user.role==='manager'||risk.createdBy===user.id;
 const riskCount=risks.filter(r=>r.status!=='Kapalı').length;
 const highCount=risks.filter(r=>r.status!=='Kapalı'&&(riskAssessment(r.likelihood,r.impact)?.score||0)>=15).length;
 const lateCount=risks.filter(r=>r.status!=='Kapalı'&&r.targetAt&&r.targetAt<today()).length;
 return <section className="risk-workspace panel">
   <div className="risk-header"><div className="risk-toolbar"><Field label="Proje seçimi"><select aria-label="Risk projesi" value={projectId} onChange={e=>{setProjectId(e.target.value);setExportError('')}}><option value="">Proje seçin</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><button type="button" className="button risk-export-button" disabled={!project} onClick={()=>{if(!project)return;try{downloadRiskPlan(project,risks);setExportError('')}catch(e){setExportError((e as Error).message)}}}><Download size={16}/>Excel'e Aktar</button><button type="button" className="button primary" data-risk-add disabled={!project} onClick={()=>setCreateSignal(value=>value+1)}><Plus size={16}/>Risk Ekle</button></div></div>
   {!project?<div className="risk-placeholder"><ShieldAlert size={32}/><strong>Risk planını açmak için bir proje seçin</strong><span>Seçilen projenin riskleri tüm kullanıcılar tarafından görüntülenebilir.</span></div>:<>
    <div className="risk-summary"><div><small>TOPLAM RİSK</small><strong>{risks.length}</strong></div><div><small>AÇIK / TAKİPTE</small><strong>{riskCount}</strong></div><div><small>YÜKSEK / TOLERE EDİLEMEZ</small><strong>{highCount}</strong></div><div><small>HEDEF TARİHİ GEÇEN</small><strong>{lateCount}</strong></div></div>
    {exportError&&<div className="risk-export-error" role="alert">{exportError}</div>}
    <RiskTable risks={risks} projectId={projectId} createSignal={createSignal} createRisk={()=>blank(projectId,user)} canEdit={canEdit} canDelete={user.role!=='normal'} onSave={onSave} onDelete={onDelete}/>
    <details className="risk-matrix-panel"><summary>Etki–olasılık matrisini göster</summary><div className="risk-matrix-scroll"><table><thead><tr><th>Olasılık / Etki</th>{impactNames.map((name,i)=><th key={name}>{i+1} · {name}</th>)}</tr></thead><tbody>{likelihoodNames.map((name,i)=><tr key={name}><th>{i+1} · {name}</th>{impactNames.map((_,j)=><td key={j}><Score likelihood={i+1} impact={j+1}/></td>)}</tr>)}</tbody></table></div></details>
    <div className="risk-legend"><span>Risk matrisi: Olasılık × Etki</span><Score likelihood={1} impact={1}/><Score likelihood={1} impact={2}/><Score likelihood={2} impact={4}/><Score likelihood={3} impact={5}/><Score likelihood={5} impact={5}/></div>
   </>}
 </section>
}
