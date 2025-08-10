import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  baseHTTPURL = 'http://localhost:9001';
}

export const baseURL = `${baseHTTPURL}/api/v1`;

// Standard response interface to match Axios-like structure
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
}

export interface RequestConfig extends Omit<RequestInit, 'body'> {
  baseURL?: string;
  url?: string;
  data?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  withCredentials?: boolean;
  timeout?: number;
}

export class ApiError extends Error {
  public status: number;
  public statusText: string;
  public response: Response | undefined;

  constructor(
    message: string,
    status: number,
    statusText: string,
    response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.response = response;
  }
}

// AbortController wrapper for request cancellation
export class CancelToken {
  private controller: AbortController;
  private _cancelled = false;

  constructor() {
    this.controller = new AbortController();
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public get cancelled(): boolean {
    return this._cancelled;
  }

  public cancel(reason?: string): void {
    this._cancelled = true;
    this.controller.abort(reason);
  }
}

export class CancelTokenSource {
  public token: CancelToken;

  constructor() {
    this.token = new CancelToken();
  }

  public cancel(reason?: string): void {
    this.token.cancel(reason);
  }
}

// Utility function to build URL with query parameters
function buildURL(
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${searchParams.toString()}`;
}

// Main fetch wrapper function
async function fetchWithConfig<T = unknown>(
  url: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    baseURL: configBaseURL = baseURL,
    data,
    params,
    withCredentials = false,
    timeout = 10000,
    headers: configHeaders = {},
    ...restConfig
  } = config;

  // Build full URL
  const fullURL = buildURL(
    url.startsWith('http') ? url : `${configBaseURL}${url}`,
    params
  );

  // Prepare headers
  const headers = new Headers({
    'Content-Type': 'application/vnd.api+json',
    ...configHeaders,
  });

  // Prepare request options
  const requestOptions: RequestInit = {
    ...restConfig,
    headers,
    credentials: withCredentials ? 'include' : 'omit',
  };

  // Add body for non-GET requests
  if (data && config.method && config.method !== 'GET') {
    requestOptions.body = JSON.stringify(data);
  }

  // Setup timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort('Request timeout'),
    timeout
  );

  // Use existing signal if provided, otherwise use timeout controller
  if (config.signal) {
    // If both timeout and external signal, we need to handle both
    config.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort(config.signal!.reason);
    });
  }
  requestOptions.signal = controller.signal;

  try {
    const response = await fetch(fullURL, requestOptions);
    clearTimeout(timeoutId);

    // Parse response data
    let responseData: T;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = (await response.text()) as unknown as T;
    }

    // Check if response is successful
    if (!response.ok) {
      const errorMessage = `Request failed with status ${response.status}: ${response.statusText}`;
      throw new ApiError(
        errorMessage,
        response.status,
        response.statusText,
        response
      );
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw new Error(`Network error: ${error.message}`);
    }

    throw new Error('An unknown error occurred');
  }
}

// API client class similar to Axios instance
export class FetchApiClient {
  private config: RequestConfig;

  constructor(defaultConfig: RequestConfig = {}) {
    this.config = {
      baseURL,
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
      ...defaultConfig,
    };
  }

  private async request<T = unknown>(
    url: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const mergedConfig = {
      ...this.config,
      ...config,
      headers: {
        ...this.config.headers,
        ...config.headers,
      },
    };

    return fetchWithConfig<T>(url, mergedConfig);
  }

  public async get<T = unknown>(
    url: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {...config, method: 'GET'});
  }

  public async post<T = unknown>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {...config, method: 'POST', data});
  }

  public async put<T = unknown>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {...config, method: 'PUT', data});
  }

  public async patch<T = unknown>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {...config, method: 'PATCH', data});
  }

  public async delete<T = unknown>(
    url: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {...config, method: 'DELETE'});
  }

  // Static method to create cancel token source (similar to Axios)
  public static CancelToken = {
    source: () => new CancelTokenSource(),
  };
}

// Create default instance
export const apiBase = new FetchApiClient({
  baseURL,
  headers: {
    'Content-Type': 'application/vnd.api+json',
  },
});

// Export utility functions
export {fetchWithConfig};
