import { z } from "zod";
var catalog_default = {
	leaders: [
		"AA Mühendislik Liderliği",
		"AA Ürün Teknik Yönetimi Liderliği",
		"AA Yapısal Tasarım Liderliği",
		"AA Sistem Mühendisliği Liderliği",
		"AA Elektrik Elektronik Sistemler Tasarım Liderliği",
		"AA Alt Sistemler Tasarım Liderliği",
		"AA Mühendislik Proje Yönetimi Takımı"
	],
	teams: [
		{
			"id": "cat_1",
			"name": "AA Mühendislik Liderliği Destek Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "cat_2",
			"name": "AA Kule Kontrol Sistemleri Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "cat_3",
			"name": "AA Yaşam Destek Sistemleri Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t8",
			"name": "AA Ürün Tasarım Kontrol Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "t4",
			"name": "AA Teknik Dokümantasyon Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 7,
			"catalog": true
		},
		{
			"id": "t1",
			"name": "AA Lojistik Destek Analiz Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "cat_7",
			"name": "AA Ergonomi ve Endüstriyel Tasarım Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t48",
			"name": "AA Elektronik Sistem Müh Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t50",
			"name": "AA Paletli Platformlar Sist Müh Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 2,
			"catalog": true
		},
		{
			"id": "t35",
			"name": "AA Şasi Alt Sistemleri Takımı",
			"lead": "AA Alt Sistemler Tasarım Liderliği",
			"excelCapacity": 6,
			"catalog": true
		},
		{
			"id": "t16",
			"name": "AA Kule Yapısal Tasarım Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 3,
			"catalog": true
		},
		{
			"id": "t54",
			"name": "AA Kule Platformları Sistem Mühendisliği Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "cat_13",
			"name": "AA Kule Mekanik Sistemleri Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t13",
			"name": "AA Zırh Entegrasyonu Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "cat_15",
			"name": "AA Hidrolik ve Beka Sistemleri Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t14",
			"name": "AA Detay Tasarım Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 6,
			"catalog": true
		},
		{
			"id": "t22",
			"name": "AA Uygulama Yazılımları Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 6,
			"catalog": true
		},
		{
			"id": "t52",
			"name": "AA Yazılım Sistem Mühendisliği Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "cat_19",
			"name": "AA Prototip Montaj Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "cat_20",
			"name": "AA Prototip Kaynak ve Metot Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t9",
			"name": "AA Olgunluk Yönetimi CoE",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t38",
			"name": "AA Mekanik Alt Sistemler CoE",
			"lead": "AA Alt Sistemler Tasarım Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t51",
			"name": "AA Gereksinim Yönetimi CoE",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t23",
			"name": "AA Gömülü Yazılımlar Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 6,
			"catalog": true
		},
		{
			"id": "cat_25",
			"name": "AA Trim Tasarım Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t30",
			"name": "AA Elektronik Donanımlar Tasarım Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t24",
			"name": "AA Elektro Birimler Mek Tas & Metod Tak",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t49",
			"name": "AA Entegrasyon Sistem Müh Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t25",
			"name": "AA Prog Devre Yazılımları Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 3,
			"catalog": true
		},
		{
			"id": "cat_30",
			"name": "AA 6x6 Platformlar Sistem Mühendisliği Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t43",
			"name": "AA Paramiliter Araç Platformlar Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 2,
			"catalog": true
		},
		{
			"id": "t45",
			"name": "AA 4x4 Yeni Araç Platformlar Sistem Mühendisliği Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 3,
			"catalog": true
		},
		{
			"id": "t17",
			"name": "AA Paletli Gövde Geliştirme Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 3,
			"catalog": true
		},
		{
			"id": "t44",
			"name": "AA 4x4 Türev Araç Platformlar Sistem Mühendisliği Takımı",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t18",
			"name": "AA 4x4 Gövde Geliştirme Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 7,
			"catalog": true
		},
		{
			"id": "t34",
			"name": "AA Güç Paketi Geliştirme Takımı",
			"lead": "AA Alt Sistemler Tasarım Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "cat_37",
			"name": "AA 8x8 Platformlar Sistem Mühendisliği Takımı",
			"lead": "",
			"excelCapacity": 0,
			"catalog": true
		},
		{
			"id": "t28",
			"name": "AA 4x4 EE Sistemler Tasarım Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "t36",
			"name": "AA Güç Paketi Destek Takımı",
			"lead": "AA Alt Sistemler Tasarım Liderliği",
			"excelCapacity": 2,
			"catalog": true
		},
		{
			"id": "t15",
			"name": "AA 6x6 / 8x8 Gövde Geliştirme Takımı",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "t29",
			"name": "AA EE Sistemler Gereksinim ve Kalifikasyon Yönetimi CoE",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t27",
			"name": "AA 6x6/8x8/Paletli/Kule EE Sis. Tasarım Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "t21",
			"name": "AA EE Entegre Çözümler Takımı",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t53",
			"name": "AA Beka Sistem Mühendisliği CoE",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t5",
			"name": "AA Konfigürasyon Yönetimi Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 3,
			"catalog": true
		},
		{
			"id": "t7",
			"name": "AA Ürün Ağacı ve Kütüphane Yönetimi Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 6,
			"catalog": true
		},
		{
			"id": "t6",
			"name": "AA PLM Yönetimi Takımı",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 4,
			"catalog": true
		},
		{
			"id": "t39",
			"name": "AA Mühendislik Proje Yönetimi Takımı",
			"lead": "AA Mühendislik Proje Yönetimi Takımı",
			"excelCapacity": 5,
			"catalog": true
		},
		{
			"id": "t55",
			"name": "AA Mühendislik Liderliği",
			"lead": "AA Mühendislik Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t2",
			"name": "AA Ürün Teknik Yönetimi Liderliği",
			"lead": "AA Ürün Teknik Yönetimi Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t10",
			"name": "AA Yapısal Tasarım Liderliği",
			"lead": "AA Yapısal Tasarım Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t40",
			"name": "AA Sistem Mühendisliği Liderliği",
			"lead": "AA Sistem Mühendisliği Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t19",
			"name": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"lead": "AA Elektrik Elektronik Sistemler Tasarım Liderliği",
			"excelCapacity": 1,
			"catalog": true
		},
		{
			"id": "t31",
			"name": "AA Alt Sistemler Tasarım Liderliği",
			"lead": "AA Alt Sistemler Tasarım Liderliği",
			"excelCapacity": 1,
			"catalog": true
		}
	]
};
//#endregion
//#region src/resource-dates.ts
/** Current planning month in the organisation's local time zone. */
function currentPlanningMonth(date = /* @__PURE__ */ new Date()) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Istanbul",
		year: "numeric",
		month: "2-digit"
	}).formatToParts(date);
	return parts.find((part) => part.type === "year").value + "-" + parts.find((part) => part.type === "month").value;
}
function currentYearStartDate(date = /* @__PURE__ */ new Date()) {
	return currentPlanningMonth(date).slice(0, 4) + "-01-01";
}
function monthEndDate(month) {
	return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
}
function normalizeResourceDate(value, edge) {
	return value.length === 7 ? edge === "start" ? value + "-01" : monthEndDate(value) : value;
}
/** Fraction of calendar days employed in the selected month, with both boundary dates included. */
function resourceMonthFraction(version, month) {
	const first = month + "-01", last = monthEndDate(month);
	const start = version.start ? normalizeResourceDate(version.start, "start") : first;
	const end = version.end ? normalizeResourceDate(version.end, "end") : last;
	const from = start > first ? start : first, to = end < last ? end : last;
	if (from > to) return 0;
	const ordinal = (date) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))) / 864e5;
	return (ordinal(to) - ordinal(from) + 1) / (ordinal(last) - ordinal(first) + 1);
}
//#endregion
//#region src/actual-units.ts
var HOURS_PER_WORKDAY = 9;
var DEFAULT_MONTHLY_HOURS = 180;
/** Historical Monday-Friday capacity, used when converting stored allocations to the 180-hour baseline. */
function workdaysInMonth(month) {
	const year = Number(month.slice(0, 4));
	const monthIndex = Number(month.slice(5, 7)) - 1;
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	let workdays = 0;
	for (let day = 1; day <= lastDay; day++) {
		const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
		if (weekday >= 1 && weekday <= 5) workdays++;
	}
	return workdays;
}
/** Weekends never contribute hours; marked weekdays subtract full or half days. */
function calendarHoursInMonth(month, calendar = {}) {
	const year = Number(month.slice(0, 4)), monthIndex = Number(month.slice(5, 7)) - 1;
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	let hours = 0;
	for (let day = 1; day <= lastDay; day++) {
		const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
		if (weekday === 0 || weekday === 6) continue;
		const date = month + "-" + String(day).padStart(2, "0");
		hours += 9 * (1 - (calendar[date]?.fraction || 0));
	}
	return hours;
}
/** Leave reduces capacity; training uses working time and counts as distributed work. */
function personCalendarHoursInMonth(month, resourceId, calendar = {}, personal = {}) {
	const year = Number(month.slice(0, 4)), monthIndex = Number(month.slice(5, 7)) - 1;
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	let baseHours = 0, leaveHours = 0, trainingHours = 0;
	for (let day = 1; day <= lastDay; day++) {
		const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
		if (weekday === 0 || weekday === 6) continue;
		const date = month + "-" + String(day).padStart(2, "0");
		const available = 9 * (1 - (calendar[date]?.fraction || 0));
		baseHours += available;
		const entry = personal[resourceId + "|" + date];
		if (entry?.type === "leave") leaveHours += Math.min(entry.hours, available);
		if (entry?.type === "training") trainingHours += Math.min(entry.hours, available);
	}
	return {
		baseHours,
		leaveHours,
		trainingHours
	};
}
function personHoursInMonth(month, resourceId, calendar = {}, personal = {}) {
	const { baseHours, leaveHours } = personCalendarHoursInMonth(month, resourceId, calendar, personal);
	return baseHours - leaveHours;
}
function leaveHoursInMonth(month, resourceId, calendar = {}, personal = {}) {
	return personCalendarHoursInMonth(month, resourceId, calendar, personal).leaveHours;
}
function trainingHoursInMonth(month, resourceId, calendar = {}, personal = {}) {
	return personCalendarHoursInMonth(month, resourceId, calendar, personal).trainingHours;
}
/** A manual monthly hour value represents the month before marked holidays and leave. */
function effectivePersonHoursInMonth(month, resourceId, manual, calendar = {}, personal = {}) {
	const { baseHours, leaveHours } = personCalendarHoursInMonth(month, resourceId, calendar, personal);
	if (manual === void 0) return baseHours - leaveHours;
	const holidayHours = workdaysInMonth(month) * 9 - baseHours;
	return Math.max(0, manual - holidayHours - leaveHours);
}
/** One person-month is 180 hours; a person's recorded hours may include overtime. */
function actualInputToFte(value, unit, _month, workedHours) {
	if (unit === "percent") return value / 100 * (workedHours ?? 180) / 180;
	if (unit === "days") return value * 9 / 180;
	return value / 180;
}
//#endregion
//#region src/model.ts
var workingStatuses = [
	"Aktif Çalışan",
	"SAAT Ücretli Ofis Ç.",
	"Gear Up"
];
var isWorkingStatus = (status) => workingStatuses.some((value) => value === status);
var isActualStatus = (status) => isWorkingStatus(status) || status === "İşten Ayrıldı";
var statuses = [
	...workingStatuses,
	"Aktif İlan",
	"Pasif İlan",
	"İşten Ayrıldı"
];
var phasePalette = [
	{
		id: "blue",
		name: "Mavi",
		bg: "#eaf3fe",
		ink: "#215989",
		border: "#6a9bd0"
	},
	{
		id: "green",
		name: "Yeşil",
		bg: "#e6f5ed",
		ink: "#206447",
		border: "#55a780"
	},
	{
		id: "amber",
		name: "Sarı",
		bg: "#fff3d6",
		ink: "#79530c",
		border: "#d5a442"
	},
	{
		id: "red",
		name: "Kırmızı",
		bg: "#fdecea",
		ink: "#963d35",
		border: "#d77d72"
	},
	{
		id: "purple",
		name: "Mor",
		bg: "#f0eafb",
		ink: "#65468d",
		border: "#9f82c4"
	},
	{
		id: "gray",
		name: "Gri",
		bg: "#dfe5ea",
		ink: "#43596a",
		border: "#8c9fad"
	}
];
function migrate(data) {
	const d = structuredClone(data);
	d.actualAllocations ??= {};
	d.actualWorkedHours ??= {};
	d.actualPercentEntries ??= {};
	if ((d.catalogVersion || 0) < 1) {
		for (const t of d.teams) t.catalog = false;
		for (const t of catalog_default.teams) {
			const existing = d.teams.find((x) => x.id === t.id);
			if (existing) {
				existing.name = t.name;
				existing.catalog = true;
			} else d.teams.push({ ...t });
		}
		d.leaders = [...new Set([...catalog_default.leaders, ...d.leaders || []])];
		for (const r of d.resources) for (const v of r.versions) v.lead ??= d.teams.find((t) => t.id === v.team)?.lead || "";
		d.catalogVersion = 1;
	}
	const retired = d.teams.filter((t) => !t.catalog);
	if (retired.length) {
		const ids = new Set(retired.map((t) => t.id));
		d.legacyArchive ??= {
			teams: [],
			allocations: {},
			resourceTeams: {}
		};
		for (const t of retired) if (!d.legacyArchive.teams.some((x) => x.id === t.id)) d.legacyArchive.teams.push(t);
		for (const [k, v] of Object.entries(d.allocations)) if (ids.has(k.split("|")[0])) {
			d.legacyArchive.allocations[k] = v;
			delete d.allocations[k];
		}
		for (const r of d.resources) for (const v of r.versions) if (ids.has(v.team)) {
			d.legacyArchive.resourceTeams[r.id + "|" + v.effective] = v.team;
			v.team = "";
		}
		d.teams = d.teams.filter((t) => t.catalog);
	}
	d.catalogVersion = 2;
	for (const p of d.projects) {
		p.phaseColors ??= {};
		p.milestones ??= [];
		for (const m of p.milestones) {
			if (m.start.length === 7) m.start += "-01";
			if (m.end.length === 7) m.end = new Date(Date.UTC(Number(m.end.slice(0, 4)), Number(m.end.slice(5, 7)), 0)).toISOString().slice(0, 10);
			m.barColor ??= "red";
			m.barStyle ??= "solid";
		}
	}
	for (const r of d.resources) for (const v of r.versions) {
		v.start = normalizeResourceDate(v.start, "start");
		v.end = normalizeResourceDate(v.end, "end");
	}
	const oldCalendar = !d.workCalendar;
	d.workCalendar ??= {};
	d.personCalendar ??= {};
	if (oldCalendar) for (const key of Object.keys(d.actualPercentEntries || {})) {
		const [resourceId, , month] = key.split("|");
		if (d.actualWorkedHours?.[resourceId + "|" + month] !== void 0) continue;
		const hours = personHoursInMonth(month, resourceId, d.workCalendar, d.personCalendar);
		d.actualPercentEntries[key] = hours ? (d.actualAllocations?.[key] || 0) * 180 / hours * 100 : 0;
	}
	return d;
}
function versionAt(r, m) {
	return [...r.versions].filter((v) => v.effective <= m).sort((a, b) => b.effective.localeCompare(a.effective))[0];
}
/** Use the first known assignment for actual entries before the resource's earliest effective month. */
function actualVersionAt(r, m) {
	return versionAt(r, m) || [...r.versions].sort((a, b) => a.effective.localeCompare(b.effective))[0];
}
function visibleActualVersion(r, m, currentMonth) {
	const current = versionAt(r, currentMonth);
	return current && isWorkingStatus(current.status) ? actualVersionAt(r, m) : void 0;
}
function actualTeamTotalIndex(data, allowedTeams) {
	const totals = {};
	const resources = new Map(data.resources.map((resource) => [resource.id, resource]));
	const teamAt = /* @__PURE__ */ new Map();
	for (const [key, amount] of Object.entries(data.actualAllocations || {})) {
		const [resourceId, projectId, month] = key.split("|"), assignment = resourceId + "|" + month;
		if (!teamAt.has(assignment)) {
			const resource = resources.get(resourceId);
			teamAt.set(assignment, resource ? actualVersionAt(resource, month)?.team || "" : "");
		}
		const team = teamAt.get(assignment);
		if (team && (!allowedTeams || allowedTeams.has(team))) {
			const totalKey = team + "|" + projectId + "|" + month;
			totals[totalKey] = (totals[totalKey] || 0) + amount;
		}
	}
	return totals;
}
function activeTeamMembers(data, month) {
	const byTeam = {};
	for (const resource of data.resources) {
		const version = versionAt(resource, month);
		if (!version?.included || !isWorkingStatus(version.status) || resourceMonthFraction(version, month) <= 0 || !resource.name) continue;
		(byTeam[version.team] ??= []).push(resource.name);
	}
	for (const names of Object.values(byTeam)) names.sort((a, b) => a.localeCompare(b, "tr"));
	return byTeam;
}
function fold(s) {
	return s.toLocaleLowerCase("tr").replaceAll("ı", "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
//#endregion
//#region src/milestone-ranges.ts
var CRITICAL_DATE_OVERLAP_MESSAGE = "Güncellemek istediğiniz tarih diğer kritik tarihlerin içerisindeki bir tarihtir. Tekrar kontrol ediniz.";
//#endregion
//#region src/metrics.ts
function buildCapacityIndex(d, months) {
	const out = {};
	for (const t of d.teams) for (const m of months) out[t.id + "|" + m] = {
		current: 0,
		total: 0
	};
	for (const r of d.resources) {
		const versions = [...r.versions].sort((a, b) => a.effective.localeCompare(b.effective));
		let i = -1;
		for (const m of months) {
			while (i + 1 < versions.length && versions[i + 1].effective <= m) i++;
			if (i < 0) continue;
			const v = versions[i], cell = out[v.team + "|" + m], fraction = resourceMonthFraction(v, m);
			if (!cell || !v.included || fraction === 0) continue;
			if (isActualStatus(v.status) || v.status === "Aktif İlan" && !!v.start) cell.current += v.amount * fraction;
		}
	}
	for (const [key, n] of Object.entries(d.allocations)) {
		const [t, , m] = key.split("|"), cell = out[t + "|" + m];
		if (cell) cell.total += n;
	}
	return out;
}
//#endregion
//#region src/access.ts
function allowedTeam(d, u, id) {
	return u.role === "admin" || u.role === "manager" && d.teams.some((t) => t.id === id && !!t.lead && u.leaders.includes(t.lead));
}
function scopeData(d, u) {
	if (u.role === "admin") return d;
	const leaderNames = new Set(u.leaders.length ? u.leaders : d.leaders || []);
	const teams = d.teams.filter((t) => !!t.lead && leaderNames.has(t.lead)), ids = new Set(teams.map((t) => t.id));
	const ownId = u.role === "normal" ? u.resourceId || "" : "";
	const managerCanSeePeople = u.role === "manager" && u.leaders.length > 0;
	const resourcesById = new Map(d.resources.map((resource) => [resource.id, resource]));
	const canSeeActual = (key, kind) => {
		const parts = key.split("|"), resourceId = parts[0], month = parts[kind === "actual" ? 2 : 1];
		if (u.role === "normal") return resourceId === ownId;
		if (!managerCanSeePeople || !month) return false;
		const resource = resourcesById.get(resourceId);
		return !!resource && ids.has(actualVersionAt(resource, month)?.team || "");
	};
	const actualEntries = (entries, kind) => Object.fromEntries(Object.entries(entries || {}).filter(([key]) => canSeeActual(key, kind)));
	const canSeePersonDay = (key) => {
		const [resourceId, date] = key.split("|");
		return u.role === "normal" ? resourceId === ownId : managerCanSeePeople && !!resourcesById.get(resourceId) && ids.has(actualVersionAt(resourcesById.get(resourceId), date.slice(0, 7))?.team || "");
	};
	return {
		...d,
		users: void 0,
		legacyArchive: void 0,
		teams,
		leaders: (d.leaders || []).filter((l) => leaderNames.has(l)),
		leaderManagers: Object.fromEntries(Object.entries(d.leaderManagers || {}).filter(([name]) => leaderNames.has(name))),
		resources: d.resources.filter((r) => r.versions.some((v) => ids.has(v.team))).map((r) => ({
			...r,
			name: managerCanSeePeople || r.id === ownId ? r.name : "",
			note: "",
			code: void 0,
			versions: r.versions.map((v) => ids.has(v.team) ? v : {
				effective: v.effective,
				team: "",
				lead: "",
				status: "",
				included: false,
				amount: 0,
				start: "",
				end: ""
			})
		})),
		allocations: Object.fromEntries(Object.entries(d.allocations).filter(([k]) => ids.has(k.split("|")[0]))),
		actualAllocations: actualEntries(d.actualAllocations, "actual"),
		actualWorkedHours: actualEntries(d.actualWorkedHours, "workedHours"),
		actualPercentEntries: actualEntries(d.actualPercentEntries, "actual"),
		personCalendar: Object.fromEntries(Object.entries(d.personCalendar || {}).filter(([key]) => canSeePersonDay(key))),
		actualTeamTotals: actualTeamTotalIndex(d, ids),
		revisions: Object.fromEntries(Object.entries(d.revisions).filter(([key]) => key.startsWith("allocation:") ? u.role === "manager" && ids.has(key.slice(11).split("|")[0]) : key.startsWith("actual:") ? canSeeActual(key.slice(7), "actual") : key.startsWith("workedHours:") ? canSeeActual(key.slice(12), "workedHours") : key.startsWith("personDay:") ? canSeePersonDay(key.slice(10)) : key === "calendar:shared"))
	};
}
//#endregion
//#region src/resource-import.ts
var importColumns = [
	["name", "Ad Soyad"],
	["lead", "Liderlik"],
	["team", "Takım"],
	["status", "Statü"],
	["included", "Dahil"],
	["amount", "Kişi Eşdeğeri"],
	["start", "İşbaşı Tarihi"],
	["end", "İşten Ayrılış Tarihi"],
	["note", "İK Notu"]
];
var clean = (x) => String(x ?? "").trim();
var norm = (x) => fold(clean(x)).replace(/[^a-z0-9]/g, "");
var aliases = {
	adkadro: "name",
	adsoyad: "name",
	calisanadi: "name",
	ad: "name",
	liderlikadi: "lead",
	takimadi: "team",
	statu: "status",
	kaynakplanlamasinadahil: "included",
	dahilmi: "included",
	gecerliliktarihi: "effective",
	gecerliliktarih: "effective",
	kisieşdegeri: "amount",
	miktar: "amount",
	baslangic: "start",
	baslangicayi: "start",
	bitis: "end",
	bitisayi: "end",
	sondahilolunanay: "end",
	not: "note"
};
function sourceRows(rows, date1904 = false) {
	if (rows.length < 2) throw Error("Başlık ve en az bir veri satırı bulunmalı.");
	const cols = /* @__PURE__ */ new Map();
	rows[0].cells.forEach((c, i) => {
		if (!c) return;
		const key = norm(c.value);
		const f = importColumns.find(([, label]) => norm(label) === key)?.[0] || aliases[key];
		if (f) {
			if (cols.has(f)) throw Error("Tekrarlanan sütun: " + c.value);
			cols.set(f, i);
		}
	});
	for (const f of [
		"name",
		"lead",
		"team",
		"status",
		"included",
		"amount",
		"start"
	]) if (!cols.has(f)) throw Error("Eksik sütun: " + importColumns.find((c) => c[0] === f)[1]);
	return rows.slice(1).map((row) => {
		const values = {}, problems = [];
		for (const [f, c] of cols) {
			const cell = row.cells[c];
			values[f] = cell?.value ?? "";
			if (cell?.formula) problems.push((importColumns.find((c) => c[0] === f)?.[1] || "Eski geçerlilik ayı") + ": formül yerine değeri yapıştırın.");
			if (cell?.error) problems.push("Excel hata hücresi var.");
		}
		return {
			row: row.number,
			values,
			problems,
			date1904
		};
	}).filter((r) => Object.values(r.values).some((v) => clean(v) !== ""));
}
function month(x, required, date1904) {
	if (clean(x) === "") {
		if (required) throw Error("zorunludur.");
		return "";
	}
	let value = clean(x);
	if (typeof x === "number") {
		if (!Number.isFinite(x) || x < 1 || x > 11e4) throw Error("geçersiz Excel tarihi.");
		value = new Date((date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + Math.floor(x) * 864e5).toISOString().slice(0, 7);
	} else if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
		const check = /* @__PURE__ */ new Date(value.slice(0, 10) + "T12:00:00Z");
		if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== value.slice(0, 10)) throw Error("geçersiz tarih.");
		value = value.slice(0, 7);
	} else if (/^\d{1,2}[./]\d{4}$/.test(value)) {
		const [m, y] = value.split(/[./]/);
		value = y + "-" + m.padStart(2, "0");
	} else if (/^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(value)) {
		const [day, m, y] = value.split(/[./]/);
		const dayString = y + "-" + m.padStart(2, "0") + "-" + day.padStart(2, "0"), d = /* @__PURE__ */ new Date(dayString + "T12:00:00Z");
		if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== dayString) throw Error("geçersiz tarih.");
		value = dayString.slice(0, 7);
	}
	if (!/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])$/.test(value)) throw Error("YYYY-AA biçiminde ay veya Excel tarihi girin.");
	return value;
}
function employmentDate(x, edge, required, date1904) {
	if (clean(x) === "") {
		if (required) throw Error("zorunludur.");
		return "";
	}
	let value = clean(x);
	if (typeof x === "number") {
		if (!Number.isFinite(x) || x < 1 || x > 11e4) throw Error("geçersiz Excel tarihi.");
		value = new Date((date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + Math.floor(x) * 864e5).toISOString().slice(0, 10);
	} else if (/^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(value)) {
		const [d, m, y] = value.split(/[./]/);
		value = y + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0");
	} else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) value = value.slice(0, 10);
	else if (/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])$/.test(value)) value = edge === "start" ? value + "-01" : monthEndDate(value);
	const date = /* @__PURE__ */ new Date(value + "T12:00:00Z");
	if (!/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error("GG.AA.YYYY veya YYYY-AA-GG biçiminde geçerli bir tarih girin.");
	return value;
}
function prepareImport(d, rows) {
	if (!rows.length || rows.length > 5e3) throw Error("1–5.000 veri satırı seçin.");
	const seenNames = new Set(d.resources.flatMap((r) => r.versions.map((v) => norm(r.name) + "|" + v.team)));
	const assignments = /* @__PURE__ */ new Map();
	return rows.map((source) => {
		const v = source.values, errors = [...source.problems];
		const read = (field, fn) => {
			try {
				return fn();
			} catch (e) {
				errors.push((importColumns.find((c) => c[0] === field)?.[1] || "Eski geçerlilik ayı") + ": " + e.message);
				return "";
			}
		};
		const name = clean(v.name), note = clean(v.note);
		if (!name || name.length > 200) errors.push("Ad Soyad: 1–200 karakter olmalı.");
		if (note.length > 1e4) errors.push("İK Notu: en fazla 10.000 karakter.");
		const leads = d.leaders?.filter((l) => norm(l) === norm(v.lead)) || [];
		const lead = leads.length === 1 ? leads[0] : "";
		if (!lead) errors.push("Liderlik: listeden geçerli bir liderlik girin.");
		const matches = d.teams.filter((t) => norm(t.name) === norm(v.team)), candidates = matches.filter((t) => !t.lead || t.lead === lead);
		const team = candidates.length === 1 ? candidates[0] : void 0;
		if (!team) errors.push(matches.length ? "Takım liderlikle eşleşmiyor veya adı belirsiz." : "Takım: güncel listede bulunamadı.");
		const status = statuses.find((s) => norm(s) === norm(v.status)) || "";
		if (!status) errors.push("Statü: geçerli bir statü girin.");
		const flag = norm(v.included);
		const included = [
			"evet",
			"true",
			"1"
		].includes(flag);
		if (![
			"evet",
			"true",
			"1",
			"hayir",
			"false",
			"0"
		].includes(flag)) errors.push("Dahil: Evet veya Hayır girin.");
		const amountText = clean(v.amount), amount = Number(amountText.replace(",", "."));
		if (!amountText || !/^\d+(?:[.,]\d+)?$/.test(amountText) || !Number.isFinite(amount) || amount < 0 || amount > 100) errors.push("Kişi Eşdeğeri: 0–100 arasında bir sayı girin.");
		const requiresStart = status === "İşten Ayrıldı" || included && status === "Aktif İlan";
		const startInput = clean(v.start) ? v.start : isWorkingStatus(status) ? currentYearStartDate() : v.start;
		const start = read("start", () => employmentDate(startInput, "start", requiresStart, source.date1904));
		const end = read("end", () => employmentDate(v.end, "end", status === "İşten Ayrıldı", source.date1904));
		const effective = clean(v.effective) ? read("effective", () => month(v.effective, true, source.date1904)) : start.slice(0, 7) || currentPlanningMonth();
		if (start && end && end < start) errors.push("İşten Ayrılış Tarihi, İşbaşı Tarihi’nden önce olamaz.");
		if (team && !team.lead && lead) {
			const before = assignments.get(team.id);
			if (before && before !== lead) errors.push("Bu takım dosyada birden fazla liderliğe atanmış.");
			else assignments.set(team.id, lead);
		}
		const duplicate = !!team && seenNames.has(norm(name) + "|" + team.id);
		const state = errors.length ? "error" : duplicate ? "duplicate" : "ready";
		const resource = state === "ready" ? {
			id: crypto.randomUUID(),
			name,
			note,
			versions: [{
				team: team.id,
				lead,
				status,
				included,
				amount,
				effective,
				start,
				end
			}]
		} : void 0;
		if (state === "ready") seenNames.add(norm(name) + "|" + team.id);
		return {
			source,
			state,
			errors,
			resource,
			teamName: team?.name || clean(v.team),
			lead
		};
	});
}
//#endregion
//#region src/server-domain.ts
var bad = (message) => Object.assign(Error(message), { status: 400 });
var mo = z.string().regex(/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])$/);
var day = z.string().regex(/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$/).refine((value) => {
	const parsed = /* @__PURE__ */ new Date(value + "T12:00:00Z");
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Geçersiz gün.");
var ver = z.object({
	effective: mo,
	team: z.string(),
	lead: z.string().optional(),
	status: z.enum(statuses),
	included: z.boolean(),
	start: z.union([
		day,
		mo,
		z.literal("")
	]),
	end: z.union([
		day,
		mo,
		z.literal("")
	]),
	amount: z.number().min(0).max(100)
});
var res = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(200),
	note: z.string().max(1e4),
	code: z.string().trim().max(100).optional(),
	versions: z.array(ver).min(1).max(200)
});
var milestoneNote = z.object({
	text: z.string().trim().min(1),
	includeInReport: z.boolean(),
	completed: z.boolean().optional(),
	start: day.optional(),
	end: day.optional()
});
var milestone = z.object({
	id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
	name: z.string().trim().min(1).max(200),
	start: day,
	end: day,
	additionalRanges: z.array(z.object({
		start: day,
		end: day,
		description: z.string().trim().optional(),
		notes: z.array(milestoneNote).max(10).optional(),
		color: z.enum(phasePalette.map((x) => x.id)).optional()
	})).max(19).optional(),
	barColor: z.enum(phasePalette.map((x) => x.id)).optional(),
	barStyle: z.enum([
		"solid",
		"striped",
		"outline"
	]).optional(),
	barText: z.string().trim().optional(),
	barNotes: z.array(milestoneNote).max(10).optional()
});
var proj = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(200),
	responsibleName: z.string().trim().max(200).optional(),
	start: mo,
	end: mo,
	phases: z.record(z.string().max(3e3)),
	phaseColors: z.record(z.enum(phasePalette.map((x) => x.id))).optional(),
	milestones: z.array(milestone).max(100).optional()
});
var credentialSchema = z.object({
	salt: z.string(),
	iv: z.string(),
	wrappedKey: z.string(),
	version: z.string().min(1)
});
var accountSchema = z.object({
	id: z.string().min(1),
	username: z.string().regex(/^[a-z0-9._@+-]{3,100}$/),
	name: z.string().trim().min(1).max(150),
	role: z.enum([
		"admin",
		"manager",
		"normal"
	]),
	leaders: z.array(z.string()),
	active: z.boolean(),
	credential: credentialSchema.optional()
});
var schema = z.object({
	teams: z.array(z.object({
		id: z.string(),
		name: z.string().trim().min(1).max(200),
		lead: z.string(),
		managerName: z.string().trim().max(200).optional(),
		excelCapacity: z.number(),
		catalog: z.boolean().optional()
	})).min(1),
	resources: z.array(res),
	projects: z.array(proj),
	allocations: z.record(z.number().min(0).max(1e4)),
	actualAllocations: z.record(z.number().min(0).max(100)).optional(),
	actualWorkedHours: z.record(z.number().min(0).max(1e3)).optional(),
	actualPercentEntries: z.record(z.number().min(0).max(1e4)).optional(),
	workCalendar: z.record(z.object({
		type: z.enum([
			"official",
			"religious",
			"company"
		]),
		label: z.string().trim().min(1).max(100),
		fraction: z.union([z.literal(.5), z.literal(1)])
	})).default({}),
	personCalendar: z.record(z.object({
		type: z.enum(["leave", "training"]),
		hours: z.number().finite().positive().max(9),
		label: z.string().trim().max(100)
	})).default({}),
	revisions: z.record(z.number().int().min(0)),
	leaders: z.array(z.string()).optional(),
	leaderManagers: z.record(z.string().trim().max(200)).default({}),
	catalogVersion: z.number().optional(),
	users: z.array(accountSchema).optional(),
	legacyArchive: z.object({
		teams: z.array(z.object({
			id: z.string(),
			name: z.string(),
			lead: z.string(),
			excelCapacity: z.number(),
			catalog: z.boolean().optional()
		})),
		allocations: z.record(z.number()),
		resourceTeams: z.record(z.string())
	}).optional()
});
function validate(input) {
	const d = schema.parse(input);
	delete d.users;
	if (Object.keys(d.workCalendar || {}).length > 5e3) throw bad("Çalışma takviminde en fazla 5000 tarih bulunabilir.");
	for (const date of Object.keys(d.workCalendar || {})) if (!day.safeParse(date).success) throw bad("Çalışma takviminde geçersiz tarih var.");
	if (Object.keys(d.personCalendar || {}).length > 1e5) throw bad("Kişisel takvimde çok fazla kayıt var.");
	for (const list of [
		d.teams,
		d.projects,
		d.resources
	]) if (new Set(list.map((x) => x.id)).size !== list.length) throw bad("Tekrarlanan kayıt kimliği.");
	const teamIds = new Set(d.teams.map((team) => team.id));
	const projectsById = new Map(d.projects.map((project) => [project.id, project]));
	const resourcesById = new Map(d.resources.map((resource) => [resource.id, resource]));
	for (const key of Object.keys(d.personCalendar || {})) {
		const [resourceId, date, ...extra] = key.split("|");
		if (extra.length || !resourcesById.has(resourceId) || !day.safeParse(date).success) throw bad("Geçersiz kişisel takvim kaydı.");
	}
	const leaderNames = new Set(d.leaders || []);
	for (const r of d.resources) {
		if (new Set(r.versions.map((v) => v.effective)).size !== r.versions.length) throw bad("Aynı ay için birden fazla kaynak değişikliği kaydedilemez.");
		for (const v of r.versions) {
			v.start = normalizeResourceDate(v.start, "start");
			v.end = normalizeResourceDate(v.end, "end");
			if (v.team && !teamIds.has(v.team)) throw bad("Takım bulunamadı.");
			if (v.end && v.start && v.end < v.start) throw bad("Bitiş başlangıçtan önce olamaz.");
			if (v.included && v.status === "Aktif İlan" && !v.start) throw bad("Dahil edilen aktif ilan için başlangıç ayı zorunludur.");
			if (v.status === "İşten Ayrıldı" && (!v.start || !v.end)) throw bad("İşten Ayrıldı statüsü için işbaşı ve işten ayrılış tarihleri zorunludur.");
		}
		for (const departure of r.versions.filter((v) => v.status === "İşten Ayrıldı")) for (const v of r.versions) if (v.effective <= departure.effective && (!v.end || v.end > departure.end)) {
			v.end = departure.end;
			if (v.start && v.end < v.start) throw bad("İşten ayrılış tarihi önceki çalışma döneminden önce olamaz.");
		}
	}
	for (const p of d.projects) {
		if (p.start > p.end) throw bad("Projenin bitişi başlangıçtan önce olamaz.");
		const milestones = p.milestones || [];
		if (new Set(milestones.map((m) => m.id)).size !== milestones.length) throw bad("Aynı kilometre taşı kimliği iki kez kullanılamaz.");
		for (const m of milestones) {
			const ranges = [{
				start: m.start,
				end: m.end,
				notes: m.barNotes
			}, ...m.additionalRanges || []].sort((a, b) => a.start.localeCompare(b.start));
			for (const [index, range] of ranges.entries()) {
				if (range.start > range.end || range.start < p.start + "-01" || range.end.slice(0, 7) > p.end) throw bad("Kilometre taşı proje dönemi içinde olmalı.");
				if (index && range.start <= ranges[index - 1].end) throw bad(CRITICAL_DATE_OVERLAP_MESSAGE);
				for (const note of range.notes || []) {
					const noteStart = note.start ?? range.start, noteEnd = note.end ?? range.end;
					if (noteStart > noteEnd || noteStart < p.start + "-01" || noteEnd.slice(0, 7) > p.end) throw bad("Açıklama tarihleri geçerli sırada ve proje dönemi içinde olmalı.");
				}
			}
		}
	}
	for (const [k, n] of Object.entries(d.allocations)) {
		const [t, p, m, ...extra] = k.split("|");
		if (extra.length || !teamIds.has(t) || !mo.safeParse(m).success) throw bad("Geçersiz dağıtım kaydı.");
		const pr = projectsById.get(p);
		if (!pr || n > 0 && (m < pr.start || m > pr.end)) throw bad("Proje tarihleri dışında kaynak dağıtımı var.");
	}
	d.actualAllocations ??= {};
	for (const [k, n] of Object.entries(d.actualAllocations)) {
		const [resourceId, projectId, month, ...extra] = k.split("|");
		const resource = resourcesById.get(resourceId), project = projectsById.get(projectId);
		if (extra.length || !resource || !project || !mo.safeParse(month).success || n > 0 && (month < project.start || month > project.end)) throw bad("Geçersiz gerçekleşen dağılım kaydı.");
	}
	d.actualWorkedHours ??= {};
	for (const key of Object.keys(d.actualWorkedHours)) {
		const [resourceId, month, ...extra] = key.split("|");
		if (extra.length || !resourcesById.has(resourceId) || !mo.safeParse(month).success) throw bad("Geçersiz çalışılan saat kaydı.");
	}
	d.actualPercentEntries ??= {};
	for (const [key, percent] of Object.entries(d.actualPercentEntries)) {
		const [resourceId, projectId, month, ...extra] = key.split("|");
		if (extra.length || !resourcesById.has(resourceId) || !projectsById.has(projectId) || !mo.safeParse(month).success || d.actualAllocations[key] === void 0) throw bad("Geçersiz yüzde dağılımı kaydı.");
		const manual = d.actualWorkedHours[resourceId + "|" + month];
		const expected = actualInputToFte(percent, "percent", month, effectivePersonHoursInMonth(month, resourceId, manual, d.workCalendar, d.personCalendar));
		if (Math.abs(expected - d.actualAllocations[key]) > 1e-8) throw bad("Yüzde dağılımı çalışılan saatlerle eşleşmiyor.");
	}
	for (const list of [
		d.teams,
		d.projects,
		d.resources
	]) for (const item of list) if (!/^[a-zA-Z0-9_-]{1,120}$/.test(item.id)) throw bad("Geçersiz kimlik.");
	for (const t of d.teams) if (t.lead && !leaderNames.has(t.lead)) throw bad("Geçersiz liderlik.");
	for (const name of Object.keys(d.leaderManagers || {})) if (!leaderNames.has(name)) throw bad("Geçersiz liderlik yöneticisi.");
	for (const p of d.projects) for (const m of Object.keys(p.phases)) if (!mo.safeParse(m).success) throw bad("Geçersiz proje ayı.");
	return d;
}
//#endregion
export { DEFAULT_MONTHLY_HOURS, HOURS_PER_WORKDAY, activeTeamMembers, actualInputToFte, actualTeamTotalIndex, actualVersionAt, allowedTeam, buildCapacityIndex, calendarHoursInMonth, currentPlanningMonth, effectivePersonHoursInMonth, importColumns, isActualStatus, leaveHoursInMonth, migrate, personHoursInMonth, prepareImport, resourceMonthFraction, scopeData, sourceRows, trainingHoursInMonth, validate, versionAt, visibleActualVersion, workdaysInMonth };
