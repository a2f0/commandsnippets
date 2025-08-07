declare module '*/public/mockServiceWorker.js' {
  export interface Worker {
    start(options?: {onUnhandledRequest?: string}): Promise<void>;
    stop(): void;
    use(handler: unknown): void;
    resetHandlers(): void;
  }

  export const worker: Worker;
}
