import type { Data, Resource } from "../../model";
import type {
  addCalendarDates,
  preparePersonalDayChange,
} from "../calendar-commands";

export type WorkCalendarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Data;
  mode: "shared" | "personal";
  resource: Resource | null;
  canEdit: boolean;
  canEditPersonal: boolean;
  onSaved: (data: Data) => void;
  initialYear: number;
};
export type SharedCalendarForm = Parameters<typeof addCalendarDates>[1];
export type PersonalCalendarForm = Parameters<
  typeof preparePersonalDayChange
>[2];
