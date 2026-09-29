import type {Data,Version} from './model';
import {resourceMonthFraction} from './resource-dates.ts';

export type HeadcountPoint={
 month:string;
 active:number;
 gearUp:number;
 hourly:number;
 postings:number;
 actualCount:number;
 projectedCount:number;
 actualAverage:number|null;
 projectedAverage:number|null;
 future:boolean;
};

function localMonth(){const today=new Date();return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`}

/** A resource contributes its active share of the month; FTE amount does not affect headcount. */
export function buildHeadcountTrend(data:Data,teamIds:string[],leads:string[],months:string[],asOfMonth=localMonth()):HeadcountPoint[]{
 const selectedTeams=new Set(teamIds),selectedLeads=new Set(leads);
 const teamLeads=new Map(data.teams.map(team=>[team.id,team.lead]));
 const resources=data.resources.map(resource=>({
  versions:[...resource.versions].sort((a,b)=>a.effective.localeCompare(b.effective)) as Version[],
  index:-1,
 }));
 let cumulative=0;
 return months.map((month,index)=>{
  let active=0,gearUp=0,hourly=0,postings=0;
  for(const resource of resources){
   while(resource.index+1<resource.versions.length&&resource.versions[resource.index+1].effective<=month)resource.index++;
   const version=resource.versions[resource.index];
   if(!version||!version.included||!selectedTeams.has(version.team))continue;
   if(selectedLeads.size&&!selectedLeads.has(version.lead||teamLeads.get(version.team)||''))continue;
   const fraction=resourceMonthFraction(version,month);
   if(!fraction)continue;
   if(version.status==='Aktif Çalışan'||version.status==='İşten Ayrıldı')active+=fraction;
   else if(version.status==='Gear Up')gearUp+=fraction;
   else if(version.status==='SAAT Ücretli Ofis Ç.')hourly+=fraction;
   else if(version.status==='Aktif İlan'&&version.start)postings+=fraction;
  }
  const actualCount=active+gearUp+hourly;
  const future=month>asOfMonth;
  const projectedCount=actualCount+postings;
  cumulative+=future?projectedCount:actualCount;
  const average=cumulative/(index+1);
  return {month,active,gearUp,hourly,postings,actualCount,projectedCount,
   actualAverage:future?null:average,projectedAverage:future?average:null,future};
 });
}
