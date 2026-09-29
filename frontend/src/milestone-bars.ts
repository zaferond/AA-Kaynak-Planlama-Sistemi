import type {MilestoneRange} from './model';

const daysInMonth=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();

export type MilestoneBar={range:MilestoneRange;left:number;width:number};

export function dateAtTrackPosition(clientX:number,left:number,width:number,months:string[]):string{
 if(!months.length||width<=0)throw Error('Görünür takvim ayı bulunamadı.');
 const position=Math.min(months.length-1e-9,Math.max(0,(clientX-left)/width*months.length));
 const monthIndex=Math.floor(position),month=months[monthIndex];
 const day=Math.floor((position-monthIndex)*daysInMonth(month))+1;
 return month+'-'+String(day).padStart(2,'0');
}

export function calendarDayDifference(first:string,last:string):number{
 return Math.round((Date.parse(last+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))/86400000);
}

/** Position each inclusive day range on the shared month track. */
export function milestoneBars(ranges:MilestoneRange[],months:string[]):MilestoneBar[]{
 if(!months.length)return [];
 const first=months[0]+'-01',lastMonth=months.at(-1)!;
 const last=lastMonth+'-'+String(daysInMonth(lastMonth)).padStart(2,'0');
 return ranges.flatMap(range=>{
  const from=range.start<first?first:range.start;
  const to=range.end>last?last:range.end;
  if(from>to)return [];
  const fromMonth=from.slice(0,7),toMonth=to.slice(0,7);
  const fromIndex=months.indexOf(fromMonth),toIndex=months.indexOf(toMonth);
  if(fromIndex<0||toIndex<0)return [];
  const left=(fromIndex+(Number(from.slice(8))-1)/daysInMonth(fromMonth))/months.length*100;
  const right=(toIndex+Number(to.slice(8))/daysInMonth(toMonth))/months.length*100;
  return [{range,left,width:right-left}];
 });
}
