import { applyChanges } from "./operations.mjs";

export async function changeAndView(store, user, changes) {
  // This only chooses the response path. applyChanges still validates the whole
  // batch and checks permissions/revisions inside the write transaction.
  const planningOnly =
    Array.isArray(changes) &&
    changes.length > 0 &&
    changes.every((change) => change?.kind === "allocation");
  const result = await store.mutate(
    user,
    (data, active) => applyChanges(data, active, changes),
    { returnPlanningView: planningOnly },
  );
  return planningOnly ? result : store.view(user);
}
