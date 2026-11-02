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

/** The robots meta and `X-Robots-Tag` value for every staging page. */
export const NOINDEX = 'noindex, nofollow';

export const SITE_NAME = 'Command Snippets';
export const COMPANY_NAME = 'Tearleads, LLC';
export const SUPPORT_EMAIL = 'support@tearleads.com';

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
  alt: 'The Command Snippets logo',
} as const;

/** Absolute URL of a page; paths end in `/`, as the assets are served. */
export function pageUrl(mode: string, path: string): string {
  return new URL(path, siteOrigin(mode)).href;
}

/** What the build reads back from a page it wrote. */
export interface BuiltPage {
  /** The path the page is served at, such as `/` or `/privacy/`. */
  path: string;
  /** The canonical URL it names; only pages that may be indexed have one. */
  canonical: string | undefined;
}

/**
 * Reads a built HTML file (its path in the build output, with `/`
 * separators) back as the page Workers static assets serve: `index.html`
 * files at their directory with a trailing slash, other files without
 * `.html`.
 */
export function builtPage(file: string, html: string): BuiltPage {
  const path =
    file === 'index.html' || file.endsWith('/index.html')
      ? `/${file.slice(0, -'index.html'.length)}`
      : `/${file.slice(0, -'.html'.length)}`;
  return {
    path,
    canonical: html.match(/<link rel="canonical" href="([^"]*)"/)?.[1],
  };
}

/**
 * Files whose content depends on the build mode, written into the build
 * output by the integration in `astro.config.ts`, which passes every page
 * it built. Staging's robots.txt still allows crawling, so crawlers can see
 * the `noindex`; it lists no sitemap. Production's sitemap lists each page's
 * canonical URL, so it holds exactly the pages that may be indexed.
 */
export function modeFiles(
  mode: string,
  pages: readonly BuiltPage[]
): Record<string, string> {
  if (!indexable(mode)) {
    return {
      'robots.txt': 'User-agent: *\nAllow: /\n',
      // Workers static assets headers: every file this build serves.
      _headers: `/*\n  X-Robots-Tag: ${NOINDEX}\n`,
    };
  }
  const sorted = pages.toSorted((a, b) => (a.path < b.path ? -1 : 1));
  const urls = sorted
    .flatMap(({canonical}) =>
      canonical === undefined
        ? []
        : [`  <url>\n    <loc>${canonical}</loc>\n  </url>\n`]
    )
    .join('');
  return {
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl(mode, '/sitemap.xml')}\n`,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`,
  };
}
