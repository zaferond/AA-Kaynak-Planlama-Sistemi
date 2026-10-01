import { stageChanges } from "./operations.mjs";

export async function changeAndView(store, user, changes) {
  // This only chooses the response path. Staging checks commands, permissions,
  // revisions and monthly limits; Store validates the final draft before writing.
  const planningOnly =
    Array.isArray(changes) &&
    changes.length > 0 &&
    changes.every((change) => change?.kind === "allocation");
  const result = await store.mutate(
    user,
    (data, active) => stageChanges(data, active, changes),
    { returnPlanningView: planningOnly },
  );
  return planningOnly ? result : store.view(user);
}
