import {setupWorker} from 'msw/browser';
import {handlers} from './handlers';

// Create and export the MSW service worker
export const worker = setupWorker(...handlers);
