export type RiskLevel='Anlamsız'|'Düşük'|'Orta'|'Yüksek'|'Tolere Edilemez';
export function riskAssessment(likelihood:number|null,impact:number|null):{score:number;level:RiskLevel;className:string}|null{
 if(likelihood===null||impact===null||!Number.isInteger(likelihood)||!Number.isInteger(impact)||likelihood<1||likelihood>5||impact<1||impact>5)return null;
 const score=likelihood*impact;
 if(score===1)return {score,level:'Anlamsız',className:'undefined'};
 if(score<=6)return {score,level:'Düşük',className:'low'};
 if(score<=14)return {score,level:'Orta',className:'medium'};
 if(score<=24)return {score,level:'Yüksek',className:'high'};
 return {score,level:'Tolere Edilemez',className:'critical'};
}
