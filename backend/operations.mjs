import { z } from "zod";
import { fail, admin, publicUser } from "./auth.mjs";
import {
  allowedTeam,
  prepareImport,
  validate,
  migrate,
  versionAt,
  actualVersionAt,
  currentPlanningMonth,
  actualInputToFte,
  personHoursInMonth,
  trainingHoursInMonth,
  effectivePersonHoursInMonth,
  DEFAULT_MONTHLY_HOURS,
} from "./domain/index.mjs";
import { kinds } from "./store.mjs";
const id = z.string().regex(/^[a-zA-Z0-9_|-]{1,300}$/);
const changesSchema = z
  .array(
    z.object({
      kind: z.enum(["team", "project", "resource", "allocation", "actual", "workedHours", "calendar", "personDay"]),
      id,
      value: z.unknown().optional(),
      revision: z.number().int().nonnegative(),
      operation: z.literal("delete").optional(),
    }),
  )
  .min(1)
  .max(100000);
const actualEntrySchema=z.object({
  unit:z.enum(["percent","days","hours"]),
  value:z.number().finite().min(0).max(100000),
}).strict();
const workedHoursSchema=z.number().finite().min(0).max(1000);
const calendarSchema=z.record(z.object({type:z.enum(['official','religious','company']),label:z.string().trim().min(1).max(100),fraction:z.union([z.literal(0.5),z.literal(1)])}).strict());
const personDaySchema=z.object({type:z.enum(['leave','training']),hours:z.number().finite().positive().max(9),label:z.string().trim().max(100)}).strict();
const effectiveHours=(d,resourceId,month)=>effectivePersonHoursInMonth(month,resourceId,d.actualWorkedHours?.[resourceId+'|'+month],d.workCalendar,d.personCalendar);
const trainingFte=(d,resourceId,month)=>trainingHoursInMonth(month,resourceId,d.workCalendar,d.personCalendar)/DEFAULT_MONTHLY_HOURS;
function recalculateActualPercentages(d,resourceId,month){
 const hours=effectiveHours(d,resourceId,month);
 for(const [actualKey,percent] of Object.entries(d.actualPercentEntries||{})){
  const [entryResource,,entryMonth]=actualKey.split('|');
  if(entryResource!==resourceId||entryMonth!==month)continue;
  const nextPercent=hours?(d.actualAllocations[actualKey]||0)*DEFAULT_MONTHLY_HOURS/hours*100:0;
  if(Math.abs(percent-nextPercent)>1e-10){d.actualPercentEntries[actualKey]=nextPercent;d.revisions['actual:'+actualKey]=(d.revisions['actual:'+actualKey]||0)+1;}
 }
}
function assertActualMonthlyLimit(d, resourceId, month) {
  const limit=actualInputToFte(100,"percent",month,effectiveHours(d,resourceId,month));
  let total=trainingFte(d,resourceId,month);
  for(const [key,amount] of Object.entries(d.actualAllocations||{})){
    const [person,,entryMonth]=key.split("|");
    if(person===resourceId&&entryMonth===month)total+=amount;
  }
  if(total>limit+1e-9)fail(400,"Proje dağılımı ve eğitim toplamı kişinin çalışma süresinin %100'ünü aşıyor. Lütfen dağılımı veya çalışma saatini kontrol edin.");
}
export function applyChanges(d, u, input) {
  const changes = changesSchema.parse(input),
    seen = new Set();
  for (const ch of changes) {
    const { kind, id, value, revision, operation } = ch,
      k = kind + ":" + id;
    if (seen.has(k)) fail(400, "Tekrarlanan işlem.");
    seen.add(k);
    const targetId=id.split("|")[0];
    const managerPlan=u.role === "manager" && kind === "allocation" && allowedTeam(d, publicUser(u), targetId);
    const actualKind=kind === "actual" || kind === "workedHours";
    const month=actualKind?id.split("|")[kind === "actual" ? 2 : 1]:"";
    const resource=actualKind?d.resources.find(item=>item.id === targetId):undefined;
    const assignment=resource&&month?actualVersionAt(resource,month):undefined;
    const managerActual=u.role === "manager" && actualKind && !!assignment && allowedTeam(d,publicUser(u),assignment.team);
    const ownActual=u.role === "normal" && !!u.resourceId && targetId === u.resourceId && actualKind;
    const ownDay=kind==='personDay'&&!!u.resourceId&&targetId===u.resourceId;
    if (u.role !== "admin" && !managerPlan && !managerActual && !ownActual && !ownDay)
      fail(403, "Bu işlem için yetkiniz yok.");
    if (ownActual && !resource) fail(404, "Çalışan kaynak bulunamadı.");
    if ((d.revisions[k] || 0) !== revision)
      fail(
        409,
        "Kayıt başka kullanıcı tarafından değiştirildi. Yenileyip tekrar deneyin.",
      );
    if (kind === "actual" && !operation && id.split("|")[2] > currentPlanningMonth())
      fail(400, "Gelecek aylara gerçekleşen kaynak dağılımı girilemez.");
    if (kind === "allocation") {
      if (operation) delete d.allocations[id];
      else d.allocations[id] = value;
    } else if (kind === "actual") {
      d.actualAllocations??={};d.actualPercentEntries??={};
      if (operation) {
        delete d.actualAllocations[id];
        delete d.actualPercentEntries[id];
      } else if (typeof value === "number") {
        d.actualAllocations[id]=value;
        delete d.actualPercentEntries[id];
      } else {
        const entry=actualEntrySchema.parse(value);
        const [resourceId,,month]=id.split("|");
        if(entry.unit==="percent"&&entry.value>100)fail(400,"Yüzde girişi %100'ü aşamaz.");
        const amount=actualInputToFte(entry.value,entry.unit,month,effectiveHours(d,resourceId,month));
        if(!Number.isFinite(amount)||amount>100)fail(400,"Giriş, izin verilen kaynak sınırını aşıyor.");
        d.actualAllocations[id]=amount;
        if(entry.unit==="percent")d.actualPercentEntries[id]=entry.value;
        else delete d.actualPercentEntries[id];
      }
      const [resourceId,,month]=id.split("|");
      if(resourceId&&month)assertActualMonthlyLimit(d,resourceId,month);
    } else if (kind === "workedHours") {
      const [resourceId,month,...extra]=id.split("|");
      if(extra.length||!resourceId||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||""))fail(400,"Çalışılan saat kaydı geçersiz.");
      if(!d.resources.some(resource=>resource.id===resourceId))fail(404,"Çalışan kaynak bulunamadı.");
      if(!operation&&value!==null&&month>currentPlanningMonth())fail(400,"Gelecek aylara çalışılan saat girilemez.");
      d.actualWorkedHours??={};
      if(operation||value===null)delete d.actualWorkedHours[id];
      else d.actualWorkedHours[id]=workedHoursSchema.parse(value);
      // Existing project allocations are absolute hours; changing the month's
      // total hours changes their displayed percentage, not the allocated hours.
      assertActualMonthlyLimit(d,resourceId,month);
      const limit=actualInputToFte(100,"percent",month,effectiveHours(d,resourceId,month));
      for(const [actualKey,percent] of Object.entries(d.actualPercentEntries||{})){
        const [entryResource,,entryMonth]=actualKey.split("|");
        if(entryResource!==resourceId||entryMonth!==month)continue;
        const amount=d.actualAllocations[actualKey]||0;
        const nextPercent=limit===0?0:amount/limit*100;
        if(Math.abs(percent-nextPercent)>1e-10){
          d.actualPercentEntries[actualKey]=nextPercent;
          d.revisions["actual:"+actualKey]=(d.revisions["actual:"+actualKey]||0)+1;
        }
      }
    } else if (kind === "calendar") {
      if(id!=="shared"||operation)fail(400,"Çalışma takvimi işlemi geçersiz.");
      d.workCalendar=calendarSchema.parse(value);
      for(const [actualKey,amount] of Object.entries(d.actualAllocations||{})){
        const [resourceId,,month]=actualKey.split("|");
        if(amount>0&&effectiveHours(d,resourceId,month)===0)fail(400,"Dağılım bulunan bir ayın tüm çalışma günleri tatil olarak işaretlenemez.");
      }
      const affected=new Set(Object.keys(d.actualPercentEntries||{}).map(key=>{const [resourceId,,month]=key.split('|');return resourceId+'|'+month;}));
      for(const key of affected){const [resourceId,month]=key.split('|');recalculateActualPercentages(d,resourceId,month);}
    } else if (kind === 'personDay') {
      const [resourceId,date,...extra]=id.split('|');
      if(extra.length||!d.resources.some(resource=>resource.id===resourceId)||!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date||'')||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)fail(400,'Kişisel takvim tarihi geçersiz.');
      d.personCalendar??={};
      if(operation)delete d.personCalendar[id];
      else d.personCalendar[id]=personDaySchema.parse(value);
      const month=date.slice(0,7);
      const hours=effectiveHours(d,resourceId,month);
      if(hours===0&&Object.entries(d.actualAllocations||{}).some(([key,amount])=>key.startsWith(resourceId+'|')&&key.endsWith('|'+month)&&amount>0))fail(400,'Dağılım bulunan ayın tüm çalışma saatleri izin olarak işaretlenemez.');
      recalculateActualPercentages(d,resourceId,month);
    } else {
      const c = kinds[kind];
      if (operation) {
        if (!d[c].some((x) => x.id === id)) fail(404, "Kayıt bulunamadı.");
        if (kind === "team" && d.teams.length <= 1)
          fail(409, "Son takım silinemez.");
        if (
          kind === "team" &&
          (d.resources.some((r) => r.versions.some((v) => v.team === id)) ||
            Object.keys(d.allocations).some((k) => k.split("|")[0] === id))
        )
          fail(409, "Kullanılan takım silinemez.");
        if(kind==="project"){
          for(const key of Object.keys(d.allocations))if(key.split("|")[1]===id){
            delete d.allocations[key];
            d.revisions["allocation:"+key]=(d.revisions["allocation:"+key]||0)+1;
          }
          for(const key of Object.keys(d.actualAllocations||{}))if(key.split("|")[1]===id){
            delete d.actualAllocations[key];
            d.revisions["actual:"+key]=(d.revisions["actual:"+key]||0)+1;
          }
          for(const key of Object.keys(d.actualPercentEntries||{}))if(key.split("|")[1]===id)
            delete d.actualPercentEntries[key];
          for(const key of Object.keys(d.legacyArchive?.allocations||{}))if(key.split("|")[1]===id)
            delete d.legacyArchive.allocations[key];
        }
        d[c] = d[c].filter((x) => x.id !== id);
        if(kind==="resource"){
          for(const key of Object.keys(d.actualAllocations||{}))if(key.split("|")[0]===id){delete d.actualAllocations[key];delete d.actualPercentEntries?.[key];d.revisions["actual:"+key]=(d.revisions["actual:"+key]||0)+1;}
          for(const key of Object.keys(d.actualWorkedHours||{}))if(key.split("|")[0]===id){delete d.actualWorkedHours[key];d.revisions["workedHours:"+key]=(d.revisions["workedHours:"+key]||0)+1;}
          for(const key of Object.keys(d.personCalendar||{}))if(key.split('|')[0]===id){delete d.personCalendar[key];d.revisions['personDay:'+key]=(d.revisions['personDay:'+key]||0)+1;}
        }
      } else {
        if (!value || value.id !== id) fail(400, "Kimlik eşleşmiyor.");
        if(kind==="team"){
          const previous=d.teams.find(t=>t.id===id);
          if(previous&&previous.lead!==value.lead){
            for(const resource of d.resources){
              let changed=false;
              for(const version of resource.versions)if(version.team===id){version.lead=value.lead;changed=true;}
              if(changed)d.revisions["resource:"+resource.id]=(d.revisions["resource:"+resource.id]||0)+1;
            }
          }
        }
        d[c] = [...d[c].filter((x) => x.id !== id), value];
      }
    }
    d.revisions[k] = revision + 1;
  }
  Object.assign(d, validate(d));
  return d;
}
const leaderChangeSchema=z.object({
  action:z.enum(["rename","update","delete"]),
  name:z.string().trim().min(1).max(200),
  newName:z.string().trim().min(1).max(200).optional(),
  managerName:z.string().trim().max(200).optional(),
  generation:z.number().int().nonnegative(),
});
export async function applyLeaderChange(d,u,input,c,generation){
  admin(u);
  const change=leaderChangeSchema.parse(input);
  if(change.generation!==generation)fail(409,"Liderlik listesi değişti. Yenileyip tekrar deneyin.");
  if(!d.leaders?.includes(change.name))fail(404,"Liderlik bulunamadı.");
  const linkedUsers=(await c.query("SELECT * FROM kp_user_leaders WHERE leader_name=@p0",[change.name])).rows;
  if(change.action==="rename"||change.action==="update"){
    const newName=change.newName||change.name;
    const oldManager=d.leaderManagers?.[change.name]||"";
    const managerName=change.managerName??oldManager;
    const renamed=newName!==change.name;
    if(change.action==="rename"&&!renamed)fail(400,"Farklı bir liderlik adı girin.");
    if(renamed&&d.leaders.includes(newName))fail(400,"Benzersiz bir liderlik adı girin.");
    if(!renamed&&managerName===oldManager)fail(400,"Değiştirilecek liderlik bilgisi yok.");
    d.leaderManagers??={};
    delete d.leaderManagers[change.name];
    if(managerName)d.leaderManagers[newName]=managerName;
    if(renamed){
      await c.upsert("leaders",[{name:newName,manager_name:managerName}]);
      d.leaders=d.leaders.map(name=>name===change.name?newName:name);
      for(const team of d.teams)if(team.lead===change.name){team.lead=newName;d.revisions["team:"+team.id]=(d.revisions["team:"+team.id]||0)+1;}
      for(const resource of d.resources){
        let changed=false;
        for(const version of resource.versions)if(version.lead===change.name){version.lead=newName;changed=true;}
        if(changed)d.revisions["resource:"+resource.id]=(d.revisions["resource:"+resource.id]||0)+1;
      }
      await c.upsert("user_leaders",linkedUsers.map(row=>({user_id:row.user_id,leader_name:newName})));
      await c.remove("user_leaders",linkedUsers.map(row=>({user_id:row.user_id,leader_name:change.name})));
    }
  }else{
    if(linkedUsers.length)fail(409,"Liderlik kullanıcı yetkilerinde kullanılıyor. Önce yetkileri güncelleyin.");
    const teams=d.teams.filter(team=>team.lead===change.name),ids=new Set(teams.map(team=>team.id));
    if(d.teams.length<=teams.length)fail(409,"Son takım veya liderlik silinemez.");
    if(d.resources.some(resource=>resource.versions.some(version=>ids.has(version.team)||version.lead===change.name))||Object.keys(d.allocations).some(key=>ids.has(key.split("|")[0])))
      fail(409,"Bu liderliğe bağlı çalışan kaynak veya planlanan dağılım var. Önce bağlı kayıtları taşıyın ya da temizleyin.");
    d.teams=d.teams.filter(team=>!ids.has(team.id));
    for(const team of teams)d.revisions["team:"+team.id]=(d.revisions["team:"+team.id]||0)+1;
    d.leaders=d.leaders.filter(name=>name!==change.name);
    if(d.leaderManagers)delete d.leaderManagers[change.name];
  }
  Object.assign(d,validate(d));
}
export function reset(d, u, expected) {
  admin(u);
  if (!expected || typeof expected !== "object")
    fail(400, "Sürüm bilgisi eksik.");
  const actual = Object.fromEntries(
    Object.entries(d.revisions).filter(([k]) => k.startsWith("allocation:")),
  );
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  if ([...keys].some((k) => (actual[k] || 0) !== (expected[k] || 0)))
    fail(409, "Dağılımlar değişti. Yenileyip tekrar deneyin.");
  for (const k of Object.keys(d.allocations)) {
    delete d.allocations[k];
    d.revisions["allocation:" + k] = (d.revisions["allocation:" + k] || 0) + 1;
  }
}
const rowsSchema = z
  .array(
    z.object({
      row: z.number().int(),
      values: z.record(z.union([z.string(), z.number(), z.boolean()])),
      problems: z.array(z.string()),
      date1904: z.boolean(),
    }),
  )
  .min(1)
  .max(5000);
export function importRows(d, u, input) {
  admin(u);
  const rows = prepareImport(d, rowsSchema.parse(input));
  const error = rows.find((r) => r.state === "error");
  if (error)
    fail(400, "Satır " + error.source.row + ": " + error.errors.join(" "));
  let imported = 0;
  for (const row of rows) {
    if (row.state !== "ready") continue;
    const r = row.resource;
    d.resources.push(r);
    d.revisions["resource:" + r.id] = 1;
    const t = d.teams.find((t) => t.id === r.versions[0].team);
    if (t && !t.lead) {
      t.lead = row.lead;
      d.revisions["team:" + t.id] = (d.revisions["team:" + t.id] || 0) + 1;
    }
    imported++;
  }
  return { imported, skipped: rows.length - imported };
}
export function restore(d, u, backup) {
  admin(u);
  if(backup?.personAllocations && Object.keys(backup.personAllocations).length){
    const totals={};
    for(const [key,amount] of Object.entries(backup.personAllocations)){
      const [resourceId,projectId,month,...extra]=key.split('|');
      const resource=backup.resources?.find(r=>r.id===resourceId);
      const team=resource&&versionAt(resource,month)?.team;
      if(extra.length||!team||typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100)fail(400,'Yedekte geçersiz kişi tahsisi var.');
      const target=team+'|'+projectId+'|'+month;
      totals[target]=(totals[target]||0)+amount;
    }
    backup={...backup,allocations:totals};
  }
  const next = validate(migrate(backup));
  for (const [kind, c] of Object.entries(kinds)) {
    const ids = new Set([
      ...Object.keys(d.revisions)
        .filter((k) => k.startsWith(kind + ":"))
        .map((k) => k.slice(kind.length + 1)),
      ...(kind === "allocation" || kind === "actual"
        ? Object.keys(next[c]||{})
        : next[c].map((x) => x.id)),
    ]);
    for (const id of ids)
      next.revisions[kind + ":" + id] = (d.revisions[kind + ":" + id] || 0) + 1;
  }
  for(const id of new Set([...Object.keys(d.actualWorkedHours||{}),...Object.keys(next.actualWorkedHours||{})]))
    next.revisions["workedHours:"+id]=(d.revisions["workedHours:"+id]||0)+1;
  next.revisions["calendar:shared"]=(d.revisions["calendar:shared"]||0)+1;
  for(const id of new Set([...Object.keys(d.personCalendar||{}),...Object.keys(next.personCalendar||{})]))next.revisions['personDay:'+id]=(d.revisions['personDay:'+id]||0)+1;
  Object.assign(d, next);
}
