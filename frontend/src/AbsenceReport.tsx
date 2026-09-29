import type {Data} from './model';
import {actualVersionAt} from './model';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

const dateFormat=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',year:'numeric'});
export default function AbsenceReport({data,teamIds,months}:{data:Data;teamIds:string[];months:string[]}){
 const ids=new Set(teamIds),monthSet=new Set(months);
 const rows=Object.entries(data.personCalendar||{}).flatMap(([key,item])=>{
  const [resourceId,date]=key.split('|'),resource=data.resources.find(resource=>resource.id===resourceId);
  if(!resource||!monthSet.has(date.slice(0,7)))return [];
  const team=data.teams.find(team=>team.id===actualVersionAt(resource,date.slice(0,7))?.team);
  if(!team||!ids.has(team.id))return [];
  return [{key,date,item,resource,team}];
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.resource.name.localeCompare(b.resource.name,'tr'));
 const total=rows.reduce((sum,row)=>sum+row.item.hours,0);
 return <section className="panel absence-report"><div className="panelhead"><div><h2>Çalışan İzin ve Eğitim Kayıtları</h2><p>İzin aylık çalışma saatinden düşer; eğitim dağıtılan kaynak yüzdesine eklenir.</p></div><div className="absence-report-summary"><strong>{rows.length}</strong> kayıt <span>·</span> <strong>{total.toLocaleString('tr-TR')}</strong> saat</div></div>
  {rows.length?<Table><TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Çalışan</TableHead><TableHead>Takım</TableHead><TableHead>Tür</TableHead><TableHead>Saat</TableHead><TableHead>Açıklama</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.key}><TableCell>{dateFormat.format(new Date(row.date+'T12:00:00'))}</TableCell><TableCell><strong>{row.resource.name}</strong></TableCell><TableCell>{row.team.name}</TableCell><TableCell><span className={'absence-type '+row.item.type}>{row.item.type==='leave'?'İzin':'Eğitim'}</span></TableCell><TableCell>{row.item.hours.toLocaleString('tr-TR')}</TableCell><TableCell>{row.item.label||'—'}</TableCell></TableRow>)}</TableBody></Table>:<p className="emptymsg">Seçili dönemde izin veya eğitim kaydı yok.</p>}
 </section>;
}
