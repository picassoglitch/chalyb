// Kept free of imports so it runs in unit tests.

/** One retry: most row-write failures are a dropped connection. */
export async function writeRowWithRetry(
  write: () => PromiseLike<{ error: unknown }>,
): Promise<unknown> {
  const first = await write();
  if (!first.error) return null;
  console.error('[billing] subscriptions row write failed — retrying once', first.error);
  return (await write()).error ?? null;
}

/** Whether a notification for a preapproval with no row should wait for the
 *  checkout's write. Never for the checkout's own sync after its write failed. */
export function waitForCheckoutRow(input: {
  hasRow: boolean;
  dateCreated: string | null | undefined;
  rowFailed: boolean;
  waitMs: number;
  now: number;
}): boolean {
  if (input.hasRow || input.rowFailed || !input.dateCreated) return false;
  return input.now - Date.parse(input.dateCreated) < input.waitMs;
}
