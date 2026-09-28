import {eq} from 'drizzle-orm';
import type {Context} from 'hono';
import {requireUser} from '../auth/permissions';
import type {AppEnv} from '../env';
import {
  ApiError,
  type ErrorObject,
  permissionDenied,
  validationError,
} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {nextRevision, type RevisedResource} from './owned';

/** The resource and its ordering (whose owner/touch the move honors). */
type ReorderOptions = RevisedResource & OrderedSpec;

interface Row {
  id: number;
  order: number;
  user_id: number;
  owner: number;
  scope: number;
}

/**
 * POST .../reorder with `{top, bottom}` attributes: move `top` directly above
 * `bottom` (django-ordered-model's `top.above(bottom)`). Both must belong to
 * the requesting user.
 */
export async function reorder(
  c: Context<AppEnv>,
  options: ReorderOptions
): Promise<Response> {
  const user = requireUser(c);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: options.type});

  // PrimaryKeyRelatedField validation for `top` and `bottom`.
  const errors: ErrorObject[] = [];
  const rows: Partial<Record<'top' | 'bottom', Row>> = {};
  for (const field of ['top', 'bottom'] as const) {
    const error = (detail: string, code: string) =>
      errors.push({
        detail,
        status: '400',
        source: {pointer: `/data/attributes/${field}`},
        code,
      });
    const value = attributes[field];
    if (value === undefined) {
      error('This field is required.', 'required');
    } else if (value === null) {
      error('This field may not be null.', 'null');
    } else if (!/^\d+$/.test(String(value)) || typeof value === 'boolean') {
      error(
        `Incorrect type. Expected pk value, received ${typeof value === 'string' ? 'str' : typeof value}.`,
        'incorrect_type'
      );
    } else {
      const [row] = (await db
        .select({
          id: options.id,
          order: options.order,
          user_id: options.userId,
          owner: options.userId,
          scope: options.scope,
        })
        .from(options.table)
        .where(eq(options.id, Number(value)))
        .limit(1)) as Row[];
      if (row === undefined) {
        error(
          `Invalid pk "${String(value)}" - object does not exist.`,
          'does_not_exist'
        );
      } else {
        rows[field] = row;
      }
    }
  }
  const {top, bottom} = rows;
  if (errors.length > 0 || top === undefined || bottom === undefined) {
    throw new ApiError(400, errors);
  }
  if (top.user_id !== user.id || bottom.user_id !== user.id) {
    throw permissionDenied();
  }
  if (top.scope !== bottom.scope) {
    throw validationError('top and bottom must share the same ordering scope.');
  }

  // Every row the move touches gets the requester's next revision (lib/revision).
  await new OrderedModel(db, options).above(
    top,
    bottom,
    nextRevision(options, user.id)
  );
  return c.body(null, 200);
}
