/** The message of a rejected D1 query, including drizzle's wrapped cause. */
export async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as {cause?: Error}).cause;
    return `${(error as Error).message} ${cause?.message ?? ''}`;
  }
  throw new Error('Expected the query to fail');
}
