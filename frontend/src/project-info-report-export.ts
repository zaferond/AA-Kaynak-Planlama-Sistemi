import type {ReportProject} from './project-info-report';
import {zipFiles} from './xlsx-zip.ts';

const sheetNamespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const escapeXml=(value:string)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const column=(index:number)=>String.fromCharCode(65+index);
const dateLabel=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value.slice(8,10)}.${value.slice(5,7)}.${value.slice(0,4)}`:value;

function cell(row:number,index:number,value:string,style:number){
 return `<c r="${column(index)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function projectInfoReportSheet(projects:ReportProject[]):string{
 const headers=['Proje','Bilgi','Detay Açıklamalar','İlk Başlangıç','Son Bitiş'];
 const rows:string[]=[];
 rows.push(`<row r="1" ht="29" customHeight="1">${cell(1,0,'AA Mühendislik | Kritik Proje Konuları',1)}</row>`);
 rows.push(`<row r="2" ht="22" customHeight="1">${cell(2,0,`Rapora Ekle seçili açıklamalar · ${new Date().toLocaleDateString('tr-TR')}`,2)}</row>`);
 rows.push(`<row r="3" ht="24" customHeight="1">${headers.map((header,index)=>cell(3,index,header,3)).join('')}</row>`);
 let rowNumber=4;
 for(const project of projects){
  for(const info of project.infos){
    if(!info.topics.length)continue;
    const detail=info.topics.map(topic=>`• ${topic.completed?'[Tamamlandı] ':''}${topic.text} (${dateLabel(topic.start)} – ${dateLabel(topic.end)})`).join('\n');
    const starts=info.topics.map(topic=>topic.start).sort();
    const ends=info.topics.map(topic=>topic.end).sort();
    const values=[project.name,info.name,detail,dateLabel(starts[0]),dateLabel(ends.at(-1)!)];
    const lines=detail.split(/\r?\n/).reduce((total,line)=>total+Math.max(1,Math.ceil(line.length/65)),0);
    const height=Math.min(409,Math.max(32,lines*15+12));
    rows.push(`<row r="${rowNumber}" ht="${height}" customHeight="1">${values.map((value,index)=>cell(rowNumber,index,value,rowNumber%2?0:4)).join('')}</row>`);
    rowNumber++;
  }
 }
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${sheetNamespace}"><dimension ref="A1:E${Math.max(3,rowNumber-1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="70" customWidth="1"/><col min="4" max="5" width="18" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A3:E${Math.max(3,rowNumber-1)}"/><mergeCells count="2"><mergeCell ref="A1:E1"/><mergeCell ref="A2:E2"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${sheetNamespace}"><fonts count="3"><font><sz val="10"/><color rgb="FF243B53"/><name val="Arial"/></font><font><sz val="15"/><color rgb="FFFFFFFF"/><name val="Arial"/><b/></font><font><sz val="10"/><color rgb="FF173F66"/><name val="Arial"/><b/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F66"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFEAF3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F8FC"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function projectInfoReportWorkbook(projects:ReportProject[]):Uint8Array{
 if(!projects.some(project=>project.infos.some(info=>info.topics.length)))throw Error('Rapora eklenecek açıklama bulunamadı.');
 return zipFiles({
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${sheetNamespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kritik Proje Konuları" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':styles,
  'xl/worksheets/sheet1.xml':projectInfoReportSheet(projects),
 });
}

export function downloadProjectInfoReport(projects:ReportProject[]){
 const bytes=projectInfoReportWorkbook(projects);
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');
 link.href=url;
 link.download=`AA-Kritik-Proje-Konulari-${new Date().toISOString().slice(0,10)}.xlsx`;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
