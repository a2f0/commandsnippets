/**
 * Where the website is served for each build mode (`astro build --mode
 * <mode>`), and what search engines are told about it. Only the production
 * site may be indexed: staging pages carry `noindex` in their HTML and in an
 * `X-Robots-Tag` header, and only production advertises a sitemap.
 * Production keeps its placeholder pages out of search the same way, until
 * they have content (`searchable`).
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

/**
 * Whether a page may be indexed: a production page with content. A
 * placeholder page (`layouts/Placeholder.astro`, until its copy is written)
 * carries the robots meta and names no canonical URL or `og:url` instead,
 * and the build then leaves it out of the sitemap and sends its header
 * (`modeFiles`). A page that gets real copy and drops the flag is indexable
 * and in the sitemap from the next build.
 */
export function searchable(mode: string, placeholder: boolean): boolean {
  return indexable(mode) && !placeholder;
}

/**
 * The robots meta and `X-Robots-Tag` value for every page kept out of
 * search: all of staging, and production's placeholders.
 */
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
  /** Its robots meta; only pages kept out of search have one. */
  robots: string | undefined;
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
    robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1],
  };
}

/**
 * The `_headers` patterns for a page kept out of search: the page and,
 * for a directory page, the redirects to it from the form without the slash
 * and from its `index.html`. The home page must stay indexable; its `/*`
 * would match the whole site.
 */
function pagePatterns(path: string): string[] {
  if (path === '/') {
    throw new Error('The home page cannot be kept out of search.');
  }
  return path.endsWith('/') ? [path.slice(0, -1), `${path}*`] : [path];
}

/**
 * Files whose content depends on the build mode, written into the build
 * output by the integration in `astro.config.mjs`, which passes every page
 * it built. Staging's robots.txt still allows crawling, so crawlers can see
 * the `noindex`; it lists no sitemap. Production's sitemap lists each page's
 * canonical URL, so it holds exactly the pages that may be indexed, and its
 * `_headers` sends the robots header for the pages that carry the meta.
 */
export function modeFiles(
  mode: string,
  pages: readonly BuiltPage[]
): Record<string, string> {
  if (!indexable(mode)) {
    return {
      'robots.txt': 'User-agent: *\nAllow: /\n',
      // Workers static assets headers: every file this build serves. It
      // already covers every page, so it has no per-page rules: a second
      // matching rule would send the header twice.
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
  const headers = sorted
    .flatMap(({path, robots}) =>
      robots === undefined
        ? []
        : pagePatterns(path).map(
            pattern => `${pattern}\n  X-Robots-Tag: ${robots}\n`
          )
    )
    .join('');
  return {
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl(mode, '/sitemap.xml')}\n`,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`,
    ...(headers === '' ? {} : {_headers: headers}),
  };
}
