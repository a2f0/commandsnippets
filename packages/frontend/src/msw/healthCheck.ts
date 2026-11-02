// MSW health check utilities

import {MSW_CONFIG} from './config';

/**
 * Checks that MSW answers its health endpoint, and logs the outcome: a failed
 * check is logged as an error, but never thrown, so the app still starts.
 */
export async function healthCheck(): Promise<void> {
  try {
    const response = await fetch(MSW_CONFIG.healthCheckUrl);

    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('OK: MSW health check successful:', data);
  } catch (error) {
    console.error('ERROR: MSW health check failed:', error);
  }
}
