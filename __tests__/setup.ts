import {webcrypto} from 'node:crypto';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
});

// Mock window.location to ensure tests run in 'test' environment
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    port: '3000',
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});
