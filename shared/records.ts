/** Read a stored key without treating inherited properties as records. */
export function ownValue<T>(
  record: Record<string, T> | null | undefined,
  key: string,
): T | undefined {
  return record != null && Object.hasOwn(record, key) ? record[key] : undefined;
}
