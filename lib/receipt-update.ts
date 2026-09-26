/** Omit unchanged references on edits; explicit null means detach. */
export function receiptUpdate(
  current: string | null,
  original?: { receipt_url?: string | null } | null,
): { receiptStorageId?: string | null } {
  if (original) {
    return current === (original.receipt_url ?? null)
      ? {}
      : { receiptStorageId: current };
  }
  return current === null ? {} : { receiptStorageId: current };
}
