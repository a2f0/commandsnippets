import {writeFileSync} from 'node:fs';
import {defineConfig} from 'astro/config';
import {modeFiles} from './src/lib/site';

/**
 * Writes the files that differ by build mode (robots.txt, production's
 * sitemap, staging's noindex `_headers`) into the build output. Integration
 * hooks are not told the mode, so a Vite plugin records the resolved one.
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
        for (const [name, content] of Object.entries(modeFiles(mode))) {
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
