// MSW health check utilities

import {MSW_CONFIG} from './config';

/**
 * Performs a health check to verify MSW is working correctly
 * @returns Promise that resolves when health check passes
 * @throws Error if health check fails
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
    throw error;
  }
}
