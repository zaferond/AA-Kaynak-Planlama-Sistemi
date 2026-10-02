import { stageChanges } from "./operations.mjs";

export async function changeAndView(store, user, changes, response = {}) {
  // This only chooses the response path. Staging checks commands, permissions,
  // revisions and monthly limits; Store validates the final draft before writing.
  const planningOnly =
    Array.isArray(changes) &&
    changes.length > 0 &&
    changes.every((change) => change?.kind === "allocation");
  return store.mutate(
    user,
    (data, active) => stageChanges(data, active, changes),
    {
      returnView: true,
      planningDelta:
        planningOnly &&
        response.responseMode === "planning-delta-v1" &&
        Number.isSafeInteger(response.baseGeneration) &&
        response.baseGeneration >= 0
          ? {
              baseGeneration: response.baseGeneration,
              ids: changes.map((change) => change.id),
            }
          : undefined,
    },
  );
}
