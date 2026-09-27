/**
 * Where the web app lives for each build mode (`astro build --mode <mode>`).
 * The website only links to it; signing in happens in the app.
 */
export function appUrl(mode: string): string {
  switch (mode) {
    case 'production':
      return 'https://app.commandsnippets.com';
    case 'staging':
      return 'https://app-staging.commandsnippets.com';
    default:
      // The app's Vite dev server.
      return 'http://localhost:8085';
  }
}

/** The footer's pages, in order. */
export const FOOTER_LINKS = [
  {href: '/privacy/', text: 'Privacy Policy'},
  {href: '/terms/', text: 'Terms of Service'},
  {href: '/contact/', text: 'Contact Us'},
  {href: '/about/', text: 'About'},
] as const;
