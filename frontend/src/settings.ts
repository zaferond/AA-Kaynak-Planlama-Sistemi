import {currentPlanningMonth} from './resource-dates';
export const SYSTEM_NAME = 'AA Mühendislik Liderliği Kaynak Yönetimi Sistemi';
export const TAB_LABELS = {
  plan: 'AA Planlanan Kaynak Dağılımı',
  projects: 'AA Mühendislik Liderliği Projeler',
  resources: 'Çalışan & Kaynak',
  teams: 'Liderlik ve Takımlar',
  actual: 'AA Gerçekleşen Kaynak Dağılımı',
  critical: 'Kritik Proje Konuları',
  overview: 'Raporlar',
  access: 'Yetki Kontrol Ekranı',
};
export const DEFAULT_FILTERS = { start: currentPlanningMonth().slice(0, 4) + '-01', count: 12 };
