/**
 * Checking a successful response's body against the API contract (the
 * document schemas of `@commandsnippets/api-shared`) before the app uses it.
 */
import type {z} from 'zod';

/**
 * An OK response whose body is not what the API documents for its endpoint:
 * not JSON, or not a document its schema accepts.
 *
 * It fails the call like any other failed request, so the caller's error
 * handling applies (every caller logs it, and none writes a failed call's
 * result to the store), and nothing from the body reaches the app. It never
 * signs the user out: the request went through, so the session is fine, and
 * signing out is only for responses that say it is gone (`fetchWithAuth`).
 */
export class InvalidResponseError extends Error {
  /** Where the body breaks the contract, for debugging. */
  readonly issues: readonly z.core.$ZodIssue[];

  constructor(message: string, issues: readonly z.core.$ZodIssue[] = []) {
    super(message);
    this.name = 'InvalidResponseError';
    this.issues = issues;
  }
}

const DESCRIBED_ISSUES = 3;

/**
 * The first few issues as `path: message`. zod's messages name the expected
 * and received types, never the values, so this is safe to log.
 */
export function describeIssues(issues: readonly z.core.$ZodIssue[]): string {
  const described = issues.slice(0, DESCRIBED_ISSUES).map(issue => {
    const path = issue.path.map(String).join('.');
    return `${path === '' ? '(document)' : path}: ${issue.message}`;
  });
  const more = issues.length - described.length;
  return more > 0
    ? `${described.join('; ')}; and ${more} more`
    : described.join('; ');
}

/**
 * `body` parsed with `schema`; otherwise InvalidResponseError, whose message
 * starts with `failure` (what the caller was doing).
 */
export function parseBody<S extends z.ZodType>(
  schema: S,
  body: unknown,
  failure: string
): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const {issues} = result.error;
    throw new InvalidResponseError(
      `${failure}: invalid response (${describeIssues(issues)})`,
      issues
    );
  }
  return result.data;
}

/**
 * The response's JSON body; InvalidResponseError when it is not JSON. An
 * empty body is `emptyBody` when one is given (an endpoint that may answer
 * with nothing), and not JSON otherwise.
 */
export async function readJson(
  response: Response,
  failure: string,
  emptyBody?: unknown
): Promise<unknown> {
  const text = await response.text();
  if (text === '' && emptyBody !== undefined) {
    return emptyBody;
  }
  try {
    const body: unknown = JSON.parse(text);
    return body;
  } catch {
    throw new InvalidResponseError(`${failure}: invalid response (not JSON)`);
  }
}
