import {useCallback, useEffect, useState} from 'react';
import {AdminForbiddenError, type AdminPage} from '../../lib/api/adminApi';

interface AdminListOptions<Request, Item> {
  load: (request: Request, signal: AbortSignal) => Promise<AdminPage<Item>>;
  /** The API said the viewer is not staff (revoked since the page loaded). */
  onForbidden: () => void;
  /** What the console names as failed. */
  failure: string;
  /** The request to load instead after an error (a page gone), if any. */
  fallback?: (error: unknown, request: Request) => Request | null;
}

/**
 * A page of an admin list. A new request object (a copy too: `reload`)
 * loads its page, aborting the load before it. `load`, `failure` and
 * `fallback` must stay the same across renders.
 */
export function useAdminList<Request extends object, Item>(
  initial: Request,
  {load, onForbidden, failure, fallback}: AdminListOptions<Request, Item>
) {
  const [request, setRequest] = useState(initial);
  const [page, setPage] = useState<AdminPage<Item> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    load(request, controller.signal)
      .then(result => setPage(result))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof AdminForbiddenError) {
          onForbidden();
          return;
        }
        const next = fallback?.(error, request) ?? null;
        if (next !== null) {
          setRequest(next);
          return;
        }
        console.error(`${failure} failed:`, error);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [request, onForbidden, load, failure, fallback]);

  const reload = useCallback(() => setRequest(current => ({...current})), []);

  return {request, setRequest, page, loading, loadFailed, reload};
}
