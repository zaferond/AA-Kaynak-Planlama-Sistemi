import { z } from "zod";
import { HOURS_PER_WORKDAY } from "./actual-units.ts";

export const PERSONAL_HOURS_STEP = 0.5;
export const personDaySchema = z
  .object({
    type: z.enum(["leave", "training"]),
    hours: z
      .number()
      .finite()
      .min(PERSONAL_HOURS_STEP)
      .max(HOURS_PER_WORKDAY)
      .multipleOf(PERSONAL_HOURS_STEP),
    label: z.string().trim().max(100),
  })
  .strict();
