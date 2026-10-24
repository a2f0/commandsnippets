// Outside production, index.html already says noindex for every page
// (vite.config.ts). Read when the app loads, before this renders its own.
const shellSaysNoindex =
  document.head.querySelector('meta[name="robots"]') !== null;

/**
 * Keeps the page showing it out of search results: a robots meta, which
 * React puts in the document's head while it is rendered. Users' pages
 * (`/:user/:tag`) show it, with the `X-Robots-Tag` production's `_headers`
 * sends them; it adds no second tag where index.html has one.
 */
export const RobotsNoindex = () =>
  shellSaysNoindex ? null : <meta name="robots" content="noindex, nofollow" />;
