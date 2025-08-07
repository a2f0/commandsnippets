/**
 * Utility functions for controlling MSW from WebdriverIO tests
 */
export class MswBrowserController {
  private browser: WebdriverIO.Browser;

  constructor(browser: WebdriverIO.Browser) {
    this.browser = browser;
  }

  /**
   * Start MSW worker in the browser
   */
  async startWorker(): Promise<void> {
    // First navigate to the page to ensure we're in the right context
    await this.browser.url('/');

    // Check if MSW is already started
    const workerStatus = await this.browser.execute(() => {
      return {
        hasWorker: !!(window as any).__MSW_WORKER__,
        workerType: typeof (window as any).__MSW_WORKER__,
      };
    });

    console.log('Initial MSW Worker Status:', workerStatus);

    if (workerStatus.hasWorker) {
      console.log('MSW Worker already started');
      return;
    }

    // Try to start MSW if it's not already running
    const startResult = await this.browser.execute(() => {
      return new Promise(resolve => {
        // Load MSW using the proper API
        import('msw/browser')
          .then(({setupWorker}) => {
            import('msw')
              .then(({http, HttpResponse}) => {
                try {
                  // Define handlers inline to avoid import issues
                  const handlers = [
                    // Tags endpoint
                    http.get('http://localhost:9001/api/v1/tags', () => {
                      return HttpResponse.json(
                        {
                          data: [
                            {
                              type: 'Tag',
                              id: '1',
                              attributes: {
                                name: 'test-tag-1',
                                order: 1,
                                date_updated: '2022-05-14T02:33:53.995003',
                                date_created: '2022-05-14T02:33:53.994989',
                              },
                              relationships: {
                                user: {
                                  data: {
                                    type: 'User',
                                    id: '1',
                                  },
                                },
                              },
                            },
                          ],
                          included: [],
                        },
                        {status: 200}
                      );
                    }),

                    // Entries endpoint
                    http.get('http://localhost:9001/api/v1/entries', () => {
                      return HttpResponse.json(
                        {
                          data: [
                            {
                              type: 'TextEntry',
                              id: '1',
                              attributes: {
                                content: 'test entry 1',
                                order: 1,
                                date_updated: '2022-05-14T02:33:53.995003',
                                date_created: '2022-05-14T02:33:53.994989',
                              },
                              relationships: {
                                user: {
                                  data: {
                                    type: 'User',
                                    id: '1',
                                  },
                                },
                              },
                            },
                          ],
                          included: [],
                        },
                        {status: 200}
                      );
                    }),

                    // Reorder endpoints
                    http.post(
                      'http://localhost:9001/api/v1/tags_entries/reorder',
                      () => {
                        return HttpResponse.json({data: null}, {status: 200});
                      }
                    ),

                    http.post(
                      'http://localhost:9001/api/v1/tags/reorder',
                      () => {
                        return HttpResponse.json({data: null}, {status: 200});
                      }
                    ),

                    // Auth endpoint
                    http.post('http://localhost:9001/api-token-deauth', () => {
                      return HttpResponse.json({data: {}}, {status: 200});
                    }),
                  ];

                  const worker = setupWorker(...handlers);
                  worker
                    .start({
                      onUnhandledRequest: 'bypass',
                      serviceWorker: {
                        url: '/mockServiceWorker.js',
                      },
                    })
                    .then(() => {
                      (window as any).__MSW_WORKER__ = worker;
                      console.log('MSW Worker started successfully');
                      resolve({success: true, error: null});
                    })
                    .catch((error: unknown) => {
                      console.error('MSW Worker start failed:', error);
                      resolve({
                        success: false,
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      });
                    });
                } catch (error: unknown) {
                  console.error('MSW Worker setup failed:', error);
                  resolve({
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              })
              .catch((error: unknown) => {
                console.error('MSW import failed:', error);
                resolve({
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
          })
          .catch((error: unknown) => {
            console.error('MSW Browser import failed:', error);
            resolve({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      });
    });

    console.log('MSW Start Result:', startResult);

    // Wait longer for the worker to start and check if it's available
    await this.browser.pause(3000);

    // Verify the worker started
    const finalWorkerStatus = await this.browser.execute(() => {
      return {
        hasWorker: !!(window as any).__MSW_WORKER__,
        workerType: typeof (window as any).__MSW_WORKER__,
      };
    });

    console.log('Final MSW Worker Status:', finalWorkerStatus);

    if (!finalWorkerStatus.hasWorker) {
      console.log('MSW Worker failed to start, but continuing with test...');
    }
  }

  /**
   * Stop MSW worker in the browser
   */
  async stopWorker(): Promise<void> {
    await this.browser.execute(() => {
      if ((window as any).__MSW_WORKER__) {
        (window as any).__MSW_WORKER__.stop();
        delete (window as any).__MSW_WORKER__;
      }
    });
  }

  /**
   * Add a custom handler to MSW
   */
  async addHandler(
    method: string,
    url: string,
    response: unknown
  ): Promise<void> {
    await this.browser.execute(
      (method: string, url: string, response: unknown) => {
        if ((window as any).__MSW_WORKER__) {
          // Use dynamic import instead of require
          import('msw').then(({http, HttpResponse}) => {
            const httpMethod = method.toLowerCase() as keyof typeof http;
            (window as any).__MSW_WORKER__.use(
              http[httpMethod](url, () => {
                return HttpResponse.json(response as any);
              })
            );
          });
        }
      },
      method,
      url,
      response
    );
  }

  /**
   * Remove all handlers and restore default ones
   */
  async resetHandlers(): Promise<void> {
    await this.browser.execute(() => {
      if ((window as any).__MSW_WORKER__) {
        (window as any).__MSW_WORKER__.resetHandlers();
      }
    });
  }

  /**
   * Set a specific response for an API endpoint
   */
  async mockApiResponse(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    response: unknown,
    status = 200
  ): Promise<void> {
    await this.browser.execute(
      (method: string, endpoint: string, response: unknown, status: number) => {
        if ((window as any).__MSW_WORKER__) {
          // Use dynamic import instead of require
          import('msw').then(({http, HttpResponse}) => {
            const httpMethod = method.toLowerCase() as keyof typeof http;
            (window as any).__MSW_WORKER__.use(
              http[httpMethod](endpoint, () => {
                return HttpResponse.json(response as any, {status});
              })
            );
          });
        }
      },
      method,
      endpoint,
      response,
      status
    );
  }

  /**
   * Mock a network error for an endpoint
   */
  async mockNetworkError(endpoint: string): Promise<void> {
    await this.browser.execute((endpoint: string) => {
      if ((window as any).__MSW_WORKER__) {
        // Use dynamic import instead of require
        import('msw').then(({http}) => {
          (window as any).__MSW_WORKER__.use(
            http.all(endpoint, () => {
              throw new Error('Network error');
            })
          );
        });
      }
    }, endpoint);
  }
}

// Extend WebdriverIO types
declare global {
  namespace WebdriverIO {
    interface Browser {
      msw: MswBrowserController;
    }
  }
}
