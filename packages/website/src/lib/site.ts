/**
 * Where the website is served for each build mode (`astro build --mode
 * <mode>`), and what search engines are told about it. Only the production
 * site may be indexed: staging pages carry `noindex` in their HTML and in an
 * `X-Robots-Tag` header, and only production advertises a sitemap.
 */
export function siteOrigin(mode: string): string {
  switch (mode) {
    case 'production':
      return 'https://commandsnippets.com';
    case 'staging':
      return 'https://website-staging.commandsnippets.com';
    default:
      // Astro's dev server.
      return 'http://localhost:4321';
  }
}

export function indexable(mode: string): boolean {
  return mode === 'production';
}

/** The robots meta and `X-Robots-Tag` value for every non-production page. */
export const NOINDEX = 'noindex, nofollow';

export const SITE_NAME = 'Commandsnippets';

export const SITE_DESCRIPTION =
  'An opinionated note-taking system for technical professionals.';

/**
 * The link-preview image every page names (`og:image`), rendered into
 * `public/` from the brand logo by `bun run images` (the `social` target in
 * `../../agent-tool.json`). The web app's shell names production's copy.
 */
export const PREVIEW_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'The Commandsnippets logo',
} as const;

/**
 * The pages listed in the sitemap. The placeholder footer pages (terms,
 * contact, about) stay out until they have content.
 */
export const SITEMAP_PATHS = ['/', '/privacy/'] as const;

/** Absolute URL of a page; paths end in `/`, as the assets are served. */
export function pageUrl(mode: string, path: string): string {
  return new URL(path, siteOrigin(mode)).href;
}

/**
 * Files whose content depends on the build mode, written into the build
 * output by the integration in `astro.config.mjs`. Staging's robots.txt still
 * allows crawling, so crawlers can see the `noindex`; it lists no sitemap.
 */
export function modeFiles(mode: string): Record<string, string> {
  if (!indexable(mode)) {
    return {
      'robots.txt': 'User-agent: *\nAllow: /\n',
      // Workers static assets headers: every file this build serves.
      _headers: `/*\n  X-Robots-Tag: ${NOINDEX}\n`,
    };
  }
  const urls = SITEMAP_PATHS.map(
    path => `  <url>\n    <loc>${pageUrl(mode, path)}</loc>\n  </url>\n`
  ).join('');
  return {
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl(mode, '/sitemap.xml')}\n`,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`,
  };
}
