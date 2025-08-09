// MSW configuration constants and utilities

export const MSW_CONFIG = {
  // Service worker configuration
  serviceWorker: {
    url: '/mockServiceWorker.js',
  },

  // Request handling configuration
  onUnhandledRequest: 'bypass' as const,

  // Health check endpoint for verification
  healthCheckUrl: 'http://localhost:9001/api/v1/health',

  // Environment check
  isEnabled: () => import.meta.env.DEV || import.meta.env.MODE === 'test',
} as const;
