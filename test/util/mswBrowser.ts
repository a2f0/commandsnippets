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
    await this.browser.execute(() => {
      // Check if MSW is already started
      if ((window as any).__MSW_WORKER__) {
        return;
      }

      // Load MSW using a script tag approach
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import('/mockServiceWorker.ts').then(({ worker }) => {
          worker.start({ onUnhandledRequest: 'bypass' });
          window.__MSW_WORKER__ = worker;
        }).catch(error => {
          console.log('MSW not available:', error);
        });
      `;
      document.head.appendChild(script);
    });

    // Wait a bit for the worker to start
    await this.browser.pause(1000);
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
          const {http, HttpResponse} = require('msw');
          (window as any).__MSW_WORKER__.use(
            http[method.toLowerCase()](url, () => {
              return HttpResponse.json(response);
            })
          );
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
          const {http, HttpResponse} = require('msw');
          (window as any).__MSW_WORKER__.use(
            http[method.toLowerCase()](endpoint, () => {
              return HttpResponse.json(response, {status});
            })
          );
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
        const {http} = require('msw');
        (window as any).__MSW_WORKER__.use(
          http.all(endpoint, () => {
            throw new Error('Network error');
          })
        );
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
