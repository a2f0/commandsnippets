import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'astro/config';
import {builtPage, modeFiles} from './src/lib/site';

/**
 * Writes the files that differ by build mode (robots.txt, production's
 * sitemap, the noindex `_headers`) into the build output, from the pages it
 * built: what each page's HTML says decides its sitemap entry and header.
 * Integration hooks are not told the mode, so a Vite plugin records the
 * resolved one.
 */
function modeFilesIntegration() {
  let mode;
  return {
    name: 'commandsnippets:mode-files',
    hooks: {
      'astro:config:setup': ({updateConfig}) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'commandsnippets:record-mode',
                configResolved(config) {
                  mode = config.mode;
                },
              },
            ],
          },
        });
      },
      'astro:build:done': ({dir}) => {
        if (mode === undefined) {
          throw new Error('The build mode was not recorded.');
        }
        const pages = readdirSync(fileURLToPath(dir), {recursive: true})
          .filter(file => file.endsWith('.html'))
          .map(file =>
            builtPage(file, readFileSync(new URL(file, dir), 'utf8'))
          );
        for (const [name, content] of Object.entries(modeFiles(mode, pages))) {
          writeFileSync(new URL(name, dir), content);
        }
      },
    },
  };
}

// A static site: every page is plain HTML in dist/, served as Worker assets.
export default defineConfig({
  output: 'static',
  build: {format: 'directory'},
  integrations: [modeFilesIntegration()],
});
