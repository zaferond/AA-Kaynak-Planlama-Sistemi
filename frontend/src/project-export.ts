import type {Project} from './model';
import {phasePalette} from './model';
import {SYSTEM_NAME} from './settings';
import {zipFiles} from './xlsx-zip';
export {zipFiles} from './xlsx-zip';

// The browser creates a self-contained XLSX. Project text is always an inline
// string, so names and phase descriptions cannot become spreadsheet formulas.
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function col(n:number){let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out}

export type ProjectReportView='detail'|'compact'|'overview';

const S={title:0,meta:1,header:2,year:3,name:4,nameAlt:5,empty:6,outside:7,phase:8,phaseCompact:14} as const;
function textCell(r:number,c:number,value:string,style:number){return `<c r="${col(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`}
function blankCell(r:number,c:number,style:number){return `<c r="${col(c)}${r}" s="${style}"/>`}
function row(r:number,height:number,cells:string[]){return `<row r="${r}" ht="${height}" customHeight="1">${cells.join('')}</row>`}
function styledRow(r:number,count:number,style:number,firstText:string,height:number){return row(r,height,Array.from({length:count},(_,c)=>c===0?textCell(r,c,firstText,style):blankCell(r,c,style)))}
function monthLabel(m:string){return new Date(m+'-01T12:00:00').toLocaleDateString('tr-TR',{month:'short',year:'numeric'})}
function wrappedLines(value:string,width:number){const limit=Math.max(9,Math.floor(width-3));return value.split(/\r?\n/).reduce((total,line)=>total+Math.max(1,Math.ceil(line.length/limit)),0)}
function phaseColor(p:Project,m:string){return p.phaseColors?.[m]||(p.phases[m]==='ÇALIŞMA YOK'?'gray':'blue')}
function phaseStyleIndex(p:Project,m:string,view:ProjectReportView){const color=Math.max(0,phasePalette.findIndex(item=>item.id===phaseColor(p,m)));return (view==='detail'?S.phase:S.phaseCompact)+color}

function stylesXml(){
 const font=(color:string,size:number,bold=false)=>`<font><sz val="${size}"/><color rgb="FF${color}"/><name val="Arial"/>${bold?'<b/>':''}</font>`;
 const fonts=[font('1D354D',10),font('28445E',15,true),font('657B90',10),font('36546E',10,true),font('173F66',10,true),...phasePalette.map(p=>font(p.ink.slice(1).toUpperCase(),10))];
 const fill=(color:string)=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...['FFFFFF','F5F8FB','DFEAF3','FFFFFF','FFFFFF','FFFFFF',...phasePalette.map(p=>p.bg.slice(1).toUpperCase())].map(fill)];
 const border='<border><left/><right/><top/><bottom style="hair"><color rgb="FFDDE6EF"/></bottom><diagonal/></border>';
 const xf=(fontId:number,fillId:number,alignment:'left'|'center'='left',wrap=true)=>`<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${alignment}" vertical="center" wrapText="${wrap?1:0}"/></xf>`;
 const styles=[xf(1,4),xf(2,3),xf(3,4,'center'),xf(4,3,'center'),xf(4,2),xf(4,5),xf(2,7,'center'),xf(2,6,'center'),...phasePalette.map((_,i)=>xf(5+i,8+i)),...phasePalette.map((_,i)=>xf(5+i,8+i,'center',false))];
 return `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="2">${border}${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function projectSheet(projects:Project[],months:string[],view:ProjectReportView){
 const monthWidth=view==='overview'?11:view==='compact'?18:29;
 const widths=[43,...months.map(()=>monthWidth)],last=col(widths.length-1),rows:string[]=[],merges=[`A1:${last}1`,`A2:${last}2`,`A3:${last}3`];
 const viewName={detail:'Ayrıntılı',compact:'Kompakt',overview:'5 yıllık genel bakış'}[view];
 const generated=new Date().toLocaleString('tr-TR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
 rows.push(styledRow(1,widths.length,S.title,'AA Mühendislik | Projeler Raporu',31));
 rows.push(styledRow(2,widths.length,S.meta,`${SYSTEM_NAME}  •  ${projects.length} proje  •  ${monthLabel(months[0])} – ${monthLabel(months.at(-1)!)}  •  Görünüm: ${viewName}  •  ${generated}`,23));
 rows.push(styledRow(3,widths.length,S.meta,view==='overview'?'● kayıtlı aşama  ·  boş ay  — proje dönemi dışı':view==='compact'?'Aşama metninin tamamı hücre seçildiğinde formül çubuğunda okunabilir.  — boş ay veya proje dönemi dışı':'Aşama renkleri proje planından alınmıştır.  — boş ay veya proje dönemi dışı',22));
 const yearCells=[textCell(4,0,'YIL',S.year)];
 for(let i=0;i<months.length;){const year=months[i].slice(0,4),start=i;while(i<months.length&&months[i].startsWith(year))i++;yearCells.push(textCell(4,start+1,year,S.year));for(let j=start+1;j<i;j++)yearCells.push(blankCell(4,j+1,S.year));if(i-start>1)merges.push(`${col(start+1)}4:${col(i)}4`)}
 rows.push(row(4,22,yearCells));
 rows.push(row(5,29,['Proje',...months.map(monthLabel)].map((label,i)=>textCell(5,i,label,S.header))));
 projects.forEach((p,i)=>{const r=i+6,alt=i%2===1,values=months.map(m=>m<p.start||m>p.end?'—':view==='overview'?(p.phases[m]?'●':'·'):p.phases[m]||'—');const height=view==='detail'?Math.min(150,Math.max(39,wrappedLines(p.name,widths[0])*15+10,...values.map((v,j)=>wrappedLines(v,widths[j+1])*14+10))):Math.min(85,Math.max(view==='overview'?30:36,wrappedLines(p.name,widths[0])*14+9));rows.push(row(r,height,[textCell(r,0,p.name,alt?S.nameAlt:S.name),...months.map((m,j)=>textCell(r,j+1,values[j],m<p.start||m>p.end?S.outside:p.phases[m]?phaseStyleIndex(p,m,view):S.empty))]))});
 const freeze=`<pane xSplit="1" ySplit="5" topLeftCell="B6" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B6" sqref="B6"/>`;
 const footer=xml('&LAA Mühendislik&R Sayfa &P / &N');
 const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A5:${last}${rows.length}"/><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="${months.length<=12?1:0}" fitToHeight="0"/><headerFooter><oddFooter>${footer}</oddFooter></headerFooter></worksheet>`;
 return sheet;
}

export function projectWorkbook(projects:Project[],months:string[],view:ProjectReportView='detail'):Uint8Array{
 if(!months.length||months.length>60||months.some(m=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)))throw Error('1–60 aylık geçerli bir görünür dönem seçin.');
 if(!projects.length)throw Error('Dışa aktarılacak proje bulunamadı.');
 const sheetName='Projeler';
 const files:Record<string,string>={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
  'docProps/core.xml':`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>AA Mühendislik</dc:creator><dc:title>Projeler Raporu</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${sheetName}'!$1:$5</definedName></definedNames></workbook>`,
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':stylesXml(),
  'xl/worksheets/sheet1.xml':projectSheet(projects,months,view),
 };
 return zipFiles(files);
}
export function downloadProjects(projects:Project[],months:string[],view:ProjectReportView='detail'){
 const bytes=projectWorkbook(projects,months,view);
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download='AA-Muhendislik-Projeler-Raporu-'+months[0]+'-'+months.at(-1)+'.xlsx';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
