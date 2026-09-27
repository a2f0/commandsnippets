import {defineConfig} from 'astro/config';

// A static site: every page is plain HTML in dist/, served as Worker assets.
export default defineConfig({
  output: 'static',
  build: {format: 'directory'},
});
