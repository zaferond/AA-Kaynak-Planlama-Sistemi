import type {Project,Risk} from './model';
import {riskAssessment} from './risk-score.ts';
import {zipFiles} from './xlsx-zip.ts';

const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const column=(index:number)=>{let value=index,result='';while(value){result=String.fromCharCode(65+(value-1)%26)+result;value=Math.floor((value-1)/26)}return result};
const cell=(row:number,col:number,style:number,content='')=>`<c r="${column(col)}${row}" s="${style}"${content?' '+content:''}/>`;
const textCell=(row:number,col:number,value:string,style:number)=>value?`<c r="${column(col)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`:cell(row,col,style);
const numberCell=(row:number,col:number,value:number|null,style:number)=>value===null?cell(row,col,style):`<c r="${column(col)}${row}" s="${style}"><v>${value}</v></c>`;
const dateSerial=(value:string)=>{const [year,month,day]=value.split('-').map(Number);return Math.round((Date.UTC(year,month-1,day)-Date.UTC(1899,11,30))/86400000)};
const dateCell=(row:number,col:number,value:string,style:number)=>value?numberCell(row,col,dateSerial(value),style):cell(row,col,style);
const formulaCell=(row:number,col:number,formula:string,cached:number|string|null,style:number)=>`<c r="${column(col)}${row}" s="${style}"${typeof cached==='number'?'':' t="str"'}><f>${xml(formula)}</f>${cached===null?'<v/>':`<v>${xml(cached)}</v>`}</c>`;
const rowXml=(number:number,height:number,cells:string[])=>`<row r="${number}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
const styles={title:1,group:2,header:3,body:4,alternate:5,date:6,dateAlternate:7,numeric:8,numericAlternate:9,strategy:10,strategyAlternate:11,undefined:12,low:13,medium:14,high:15,critical:16,axis:17};
// Risk scores are products of two 1–5 inputs. This lookup avoids changing the
// workbook's colors when a score is displayed as a cached formula result.
const scoreStyle=(score:number|null)=>score===null?styles.numeric:score===1?styles.undefined:score<=6?styles.low:score<=14?styles.medium:score<=24?styles.high:styles.critical;
const blankLevel=(score:number|null,alternate:boolean)=>score===null?(alternate?styles.alternate:styles.body):scoreStyle(score);

function stylesXml(){
 const font=(color:string,size:number,bold=false)=>`<font><sz val="${size}"/><color rgb="FF${color}"/><name val="Aptos"/>${bold?'<b/>':''}</font>`;
 const fonts=[font('223B50',10),font('FFFFFF',15,true),font('FFFFFF',9,true),font('2A4D67',9,true),font('1C3F58',10,true),font('697F91',10),font('4C5661',10,true),font('08658C',10,true),font('825B0B',10,true),font('A3312B',10,true),font('FFFFFF',10,true)];
 const fill=(color:string)=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...['183D59','225878','DCEBF4','FFFFFF','F5F9FC','E8EAED','D8F0F9','FFF1AE','FBD6D0','662B31','E5F0F6'].map(fill)];
 const border='<border><left style="thin"><color rgb="FFC8D7E2"/></left><right style="thin"><color rgb="FFC8D7E2"/></right><top style="thin"><color rgb="FFC8D7E2"/></top><bottom style="thin"><color rgb="FFC8D7E2"/></bottom><diagonal/></border>';
 const xf=(fontId:number,fillId:number,center=false,date=false)=>`<xf numFmtId="${date?164:0}" fontId="${fontId}" fillId="${fillId}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${date?' applyNumberFormat="1"':''}><alignment horizontal="${center?'center':'left'}" vertical="center" wrapText="1"/></xf>`;
 const xfs=[xf(0,0),xf(1,2),xf(2,3,true),xf(3,4,true),xf(0,5),xf(0,6),xf(0,5,true,true),xf(0,6,true,true),xf(4,5,true),xf(4,6,true),xf(4,5,true),xf(4,6,true),xf(6,7,true),xf(7,8,true),xf(8,9,true),xf(9,10,true),xf(10,11,true),xf(3,12,true)];
 const dxf=(fillColor:string,fontColor:string)=>`<dxf><font><color rgb="FF${fontColor}"/><b/></font><fill><patternFill patternType="solid"><fgColor rgb="FF${fillColor}"/><bgColor indexed="64"/></patternFill></fill></dxf>`;
 const dxfs=[dxf('E8EAED','4C5661'),dxf('D8F0F9','08658C'),dxf('FFF1AE','825B0B'),dxf('FBD6D0','A3312B'),dxf('662B31','FFFFFF')];
 return `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs></styleSheet>`;
}

const headers:Record<number,string>={2:'RİSK\nBİLDİRİMİ YAPAN\nBİRİM/SORUMLU',3:'RİSK KATEGORİSİ',4:'BİLDİRİM\nTARİHİ',5:'SİSTEM/ALT SİSTEM',6:'RİSK TANIMI\n(Risk Kaynağı-Potansiyel Olay-Olayın Sonucu)',7:'POTANSİYEL SEBEP',8:'AKSİYON PLANI',9:'HEDEF TARİH',10:'STATÜ',11:'RİSK SORUMLUSU',12:'OLASILIK',13:'ETKİ',14:'RİSK PUANI\n(Olasılık × Etki)',15:'RİSK SEVİYESİ',16:'RİSK STRATEJİSİ',20:'AKSİYONUN\nDEVREYE ALINMA TARİHİ',21:'GERÇEKLEŞTİRİLEN\nAKSİYON & DEĞERLENDİRME',22:'OLASILIK',23:'ETKİ',24:'ALINAN AKSİYON SONRASI\nRİSK PUANI (Olasılık × Etki)',25:'RİSK SEVİYESİ'};
const strategyColumns:[string,number][]=[['Kaçınma',16],['Kontrol',17],['Üstlenme-Kabul',18],['Transfer',19]];
const columnWidths=[3.5,18.2,13.2,13.5,16.6,48,40,45,13,12,20,10,8,19,20,13,15.5,15,12.5,17,31,10,8,22,20];
function estimatedHeight(risk:Risk){const content:[[string,number],[string,number],[string,number],[string,number]]=[[risk.description,48],[risk.cause,40],[risk.actionPlan,45],[risk.actionResult,31]];return Math.min(409,Math.max(50,...content.map(([value,width])=>Math.ceil((value.length+value.split('\n').length*2)/Math.max(8,width-5))*15+14)))}
function riskRow(row:number,risk:Risk|undefined){
 const alt=row%2===1,base=alt?styles.alternate:styles.body,num=alt?styles.numericAlternate:styles.numeric,strategy=alt?styles.strategyAlternate:styles.strategy;
 const initial=risk?riskAssessment(risk.likelihood,risk.impact):null,residual=risk?riskAssessment(risk.residualLikelihood,risk.residualImpact):null;
 const scoreFormula=(a:string,b:string)=>`IF(OR(${a}${row}="",${b}${row}=""),"",${a}${row}*${b}${row})`;
 const levelFormula=(score:string)=>`IF(${score}${row}="","",IF(${score}${row}=1,"Anlamsız",IF(${score}${row}=25,"Tolere Edilemez",IF(${score}${row}<=6,"Düşük",IF(${score}${row}<=14,"Orta","Yüksek")))))`;
 const c=[cell(row,1,base),textCell(row,2,risk?.reportedBy||'',base),textCell(row,3,risk?.category||'',base),dateCell(row,4,risk?.reportedAt||'',alt?styles.dateAlternate:styles.date),textCell(row,5,risk?.system||'',base),textCell(row,6,risk?.description||'',base),textCell(row,7,risk?.cause||'',base),textCell(row,8,risk?.actionPlan||'',base),dateCell(row,9,risk?.targetAt||'',alt?styles.dateAlternate:styles.date),textCell(row,10,risk?.status||'',base),textCell(row,11,risk?.owner||'',base),numberCell(row,12,risk?.likelihood??null,num),numberCell(row,13,risk?.impact??null,num),formulaCell(row,14,scoreFormula('L','M'),initial?.score??null,scoreStyle(initial?.score??null)),formulaCell(row,15,levelFormula('N'),initial?.level??null,blankLevel(initial?.score??null,alt))];
 for(const [name,index] of strategyColumns)c.push(textCell(row,index,risk?.strategy===name?'X':'',strategy));
 c.push(dateCell(row,20,risk?.implementedAt||'',alt?styles.dateAlternate:styles.date),textCell(row,21,risk?.actionResult||'',base),numberCell(row,22,risk?.residualLikelihood??null,num),numberCell(row,23,risk?.residualImpact??null,num),formulaCell(row,24,scoreFormula('V','W'),residual?.score??null,scoreStyle(residual?.score??null)),formulaCell(row,25,levelFormula('X'),residual?.level??null,blankLevel(residual?.score??null,alt)));
 return rowXml(row,risk?estimatedHeight(risk):51,c);
}
function conditionalFormatting(startRow:number,endRow:number,scoreColumn:'N'|'X',lastColumn:'O'|'Y',priorityStart:number){
 const bands=[`$${scoreColumn}6=1`,`AND($${scoreColumn}6>=2,$${scoreColumn}6<=6)`,`AND($${scoreColumn}6>=7,$${scoreColumn}6<=14)`,`AND($${scoreColumn}6>=15,$${scoreColumn}6<=24)`,`$${scoreColumn}6=25`];
 return `<conditionalFormatting sqref="${scoreColumn}${startRow}:${lastColumn}${endRow}">${bands.map((formula,i)=>`<cfRule type="expression" dxfId="${i}" priority="${priorityStart+i}"><formula>${xml(formula)}</formula></cfRule>`).join('')}</conditionalFormatting>`;
}
function registerSheet(project:Project,risks:Risk[]){
 const length=Math.max(20,risks.length),lastRow=length+5,rows:string[]=[],merges=['B1:Y2','P3:S3'];
 rows.push(rowXml(1,30,[cell(1,1,styles.title),...Array.from({length:24},(_,i)=>textCell(1,i+2,i===0?`${project.name.toLocaleUpperCase('tr-TR')} PROJESİ RİSK ELE ALMA PLANI`:'',styles.title))]));
 rows.push(rowXml(2,18,Array.from({length:25},(_,i)=>cell(2,i+1,styles.title))));
 for(let index=2;index<=25;index++)if(index<16||index>19)merges.push(`${column(index)}3:${column(index)}4`);
 rows.push(rowXml(3,43,Array.from({length:25},(_,i)=>textCell(3,i+1,headers[i+1]||'',styles.group))));
 rows.push(rowXml(4,31,Array.from({length:25},(_,i)=>textCell(4,i+1,strategyColumns.find(([,col])=>col===i+1)?.[0]||'',i+1>=16&&i+1<=19?styles.header:styles.group))));
 rows.push(rowXml(5,9,Array.from({length:25},(_,i)=>cell(5,i+1,styles.body))));
 for(let i=0;i<length;i++)rows.push(riskRow(i+6,risks[i]));
 const widths=columnWidths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('');
 const validations=`<dataValidations count="4"><dataValidation type="list" allowBlank="1" showErrorMessage="1" error="Takvim, Mali, Teknik veya İdari seçin." sqref="C6:C${lastRow}"><formula1>"Takvim,Mali,Teknik,İdari"</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" error="Açık, Kapalı veya Takipte seçin." sqref="J6:J${lastRow}"><formula1>"Açık,Kapalı,Takipte"</formula1></dataValidation><dataValidation type="whole" operator="between" allowBlank="1" showErrorMessage="1" error="1 ile 5 arasında bir tam sayı girin." sqref="L6:M${lastRow} V6:W${lastRow}"><formula1>1</formula1><formula2>5</formula2></dataValidation><dataValidation type="list" allowBlank="1" sqref="P6:S${lastRow}"><formula1>"X"</formula1></dataValidation></dataValidations>`;
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:Y${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="85"><pane ySplit="5" topLeftCell="B6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B6" sqref="B6"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${widths}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>${conditionalFormatting(6,lastRow,'N','O',1)}${conditionalFormatting(6,lastRow,'X','Y',6)}${validations}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function matrixSheet(){
 const likelihood=['Çok Küçük','Küçük','Orta Derece','Yüksek','Çok Yüksek'],impact=['Çok Hafif','Hafif','Orta Derece','Ciddi','Çok Ciddi'];
 const rows=[rowXml(1,36,[textCell(1,1,'ETKİ – OLASILIK RİSK MATRİSİ',styles.title),...Array.from({length:5},(_,i)=>cell(1,i+2,styles.title))]),rowXml(2,25,[textCell(2,1,'OLASILIK ↓',styles.axis),textCell(2,2,'ETKİ →',styles.axis),...Array.from({length:4},(_,i)=>cell(2,i+3,styles.axis))]),rowXml(3,39,[textCell(3,1,'OLASILIK / ETKİ',styles.axis),...impact.map((name,i)=>textCell(3,i+2,`${i+1} · ${name}`,styles.axis))])];
 for(let probability=1;probability<=5;probability++)rows.push(rowXml(probability+3,54,[textCell(probability+3,1,`${probability} · ${likelihood[probability-1]}`,styles.axis),...impact.map((_,index)=>{const assessment=riskAssessment(probability,index+1)!;return textCell(probability+3,index+2,`${assessment.level}\n${assessment.score}`,scoreStyle(assessment.score))})]));
 rows.push(rowXml(9,27,[textCell(9,1,'Puan = Olasılık × Etki',styles.axis)]));
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><dimension ref="A1:F9"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100"/></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="23" customWidth="1"/><col min="2" max="6" width="22" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="3"><mergeCell ref="A1:F1"/><mergeCell ref="B2:F2"/><mergeCell ref="A9:F9"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>`;
}
export function riskWorkbook(project:Project,risks:Risk[]):Uint8Array{
 if(!project?.id||!project.name)throw Error('Excel için bir proje seçin.');
 if(risks.some(risk=>risk.projectId!==project.id))throw Error('Risk kayıtları seçili projeye ait olmalı.');
 const files:Record<string,string>={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="FT.540.001-1" sheetId="1" r:id="rId1"/><sheet name="Etki-Olasılık Tablosu" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':stylesXml(),
  'xl/worksheets/sheet1.xml':registerSheet(project,risks),
  'xl/worksheets/sheet2.xml':matrixSheet(),
 };
 return zipFiles(files);
}
export function downloadRiskPlan(project:Project,risks:Risk[]){
 const bytes=riskWorkbook(project,risks),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`AA-Risk-Plani-${project.name.replace(/[^\p{L}\p{N}]+/gu,'-').slice(0,60)}-${new Date().toISOString().slice(0,10)}.xlsx`;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
