import {createTracker, type TrackerOptions} from '@a2f0/ct-client';

const pages = new Set(['/', '/about/', '/contact/', '/privacy/', '/terms/']);

export function trackingOptions(
  mode: string,
  productionBuild: boolean,
  location: Pick<Location, 'origin' | 'pathname'>
): TrackerOptions | undefined {
  if (!productionBuild) return;
  if (mode !== 'production' && mode !== 'staging') return;
  const origin =
    mode === 'production'
      ? 'https://commandsnippets.com'
      : 'https://website-staging.commandsnippets.com';
  if (location.origin !== origin) return;
  return {
    site: 'commandsnippets',
    app: 'website',
    environment: mode,
    capture: 'all',
    overrideGpc: true,
    page: () => (pages.has(location.pathname) ? location.pathname : '/'),
  };
}

/** Called explicitly by the shared layout's browser script. */
export function initClickTracking(): void {
  if (typeof window === 'undefined') return;
  const options = trackingOptions(
    import.meta.env.MODE,
    import.meta.env.PROD,
    location
  );
  if (options) createTracker(options).init();
}
