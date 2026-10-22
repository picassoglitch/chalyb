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
