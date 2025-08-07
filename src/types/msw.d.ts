declare module '*/public/mockServiceWorker.ts' {
  export interface Worker {
    start(options?: {onUnhandledRequest?: string}): Promise<void>;
    stop(): void;
    use(handler: unknown): void;
    resetHandlers(): void;
  }

  export const worker: Worker;
}
