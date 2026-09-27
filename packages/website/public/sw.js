// The web app used to be served on this host and installed a service worker
// here (vite-plugin-pwa: /sw.js, scope /). Browsers keep a service worker
// until its script changes, and that one can still answer with the old app
// from its caches, including its OAuth redirect URIs that no longer exist.
// This script replaces it: it takes over at once, empties the caches,
// unregisters itself, and reloads the open pages from the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({type: 'window'});
      await Promise.all(windows.map(client => client.navigate(client.url)));
    })()
  );
});
