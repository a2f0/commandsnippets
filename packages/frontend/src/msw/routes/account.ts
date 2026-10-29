/** The signed-in user's own routes: `/user/`, analytics, backups and data versions. */
import {
  analyticsSearchQuerySchema,
  backupSchema,
  CODES,
  type DataVersionDocument,
  type DataVersionListDocument,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {mockAnalytics} from '../analytics';
import {apiError} from '../requests';

import {route, SIGNED_IN_USER} from '../route';
import {activeEntries, junctionsOf} from '../rows';
import {activeVersion, reuses, setVersions, tags, versions} from '../state';
import {
  backupOf,
  currentData,
  dataVersionResource,
  restoreBackup,
  switchTo,
  versionNamed,
} from '../versions';

export const accountRoutes = (baseUrl: string) => [
  // The signed-in user (read by the admin page)
  route('GET', `${baseUrl}/user/`, () =>
    HttpResponse.json({
      data: {
        type: 'User',
        id: '1',
        attributes: {
          username: SIGNED_IN_USER,
          is_staff: true,
          date_updated: '2026-09-01T00:00:00.000000',
          data_version: activeVersion,
        },
      },
    })
  ),

  route('GET', `${baseUrl}/user/analytics`, ({request}) => {
    const parsed = analyticsSearchQuerySchema.safeParse([
      ...new URL(request.url).searchParams,
    ]);
    if (!parsed.success)
      throw apiError(
        400,
        CODES.invalid,
        parsed.error.issues[0]?.message ?? 'Invalid analytics query.'
      );
    const params = parsed.data;
    const state = activeEntries();
    return HttpResponse.json(
      mockAnalytics(
        params,
        activeVersion,
        tags,
        state.data,
        junctionsOf(state),
        reuses.map(row => row.reuse)
      )
    );
  }),

  // A version's backup: the active one's, or `?version=`'s.
  route('GET', `${baseUrl}/user/backup`, ({request}) => {
    const named = new URL(request.url).searchParams.get('version');
    const version = named === null ? undefined : versionNamed(named);
    return HttpResponse.json(backupOf(version?.saved ?? currentData()), {
      headers: {'Cache-Control': 'no-store'},
    });
  }),
  // The data versions: listed, made active, and deleted.
  route('GET', `${baseUrl}/user/data_versions`, () => {
    const body: DataVersionListDocument = {
      data: [...versions]
        .sort((a, b) => b.version - a.version)
        .map(dataVersionResource),
    };
    return HttpResponse.json(body);
  }),
  route(
    'POST',
    `${baseUrl}/user/data_versions/:version/activate`,
    ({params}) => {
      const version = versionNamed(String(params['version']));
      if (version.version !== activeVersion && version.saved !== null) {
        switchTo(version, version.saved);
      }
      const body: DataVersionDocument = {
        data: dataVersionResource(version),
      };
      return HttpResponse.json(body);
    }
  ),
  route('DELETE', `${baseUrl}/user/data_versions/:version`, ({params}) => {
    const version = versionNamed(String(params['version']));
    if (version.version === activeVersion) {
      throw apiError(
        400,
        CODES.invalid,
        'The active data version cannot be deleted.'
      );
    }
    setVersions(versions.filter(candidate => candidate !== version));
    return new HttpResponse(null, {status: 204});
  }),
  route('POST', `${baseUrl}/user/restore`, async ({request}) => {
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = backupSchema.safeParse(body);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const pointer = `/${(issue?.path ?? []).map(String).join('/')}`;
      throw apiError(
        400,
        CODES.invalid,
        `Invalid backup at ${pointer}: ${issue?.message ?? 'invalid'}`
      );
    }
    return HttpResponse.json(restoreBackup(parsed.data), {
      headers: {'Cache-Control': 'no-store'},
    });
  }),
];
