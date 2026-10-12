import { currentPlanningMonth } from "./resource-dates.ts";
export { SYSTEM_NAME, UI_THEME } from "./branding.ts";
export const TAB_LABELS = {
  plan: "AA Planlanan Kaynak Dağılımı",
  projects: "AA Mühendislik Liderliği Projeler",
  risk: "AA Risk Yönetimi",
  resources: "Organizasyon & Çalışan & Yetki",
  actual: "AA Gerçekleşen Kaynak Dağılımı",
  activity: "AA Aylık Aktivite Raporu",
  critical: "AA Kritik Proje Konuları",
  overview: "AA Kaynak Planlama Raporları",
};
export const DEFAULT_FILTERS = {
  start: currentPlanningMonth().slice(0, 4) + "-01",
  count: 12,
};
