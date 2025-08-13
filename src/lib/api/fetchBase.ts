import {baseURL} from './baseUrl';

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
  public data?: unknown;

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

// Note: Using native AbortController/AbortSignal for request cancellation

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

  // Setup timeout and signal handling
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort('Request timeout'),
    timeout
  );

  // Use existing signal if provided, otherwise use timeout controller
  if (config.signal) {
    // If external signal is provided, use it and also handle timeout
    config.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });
    requestOptions.signal = config.signal;
  } else {
    // If no external signal, use timeout controller
    requestOptions.signal = timeoutController.signal;
  }

  try {
    const response = await fetch(fullURL, requestOptions);
    clearTimeout(timeoutId);

    // Check if response is successful first
    if (!response.ok) {
      // Try to parse error response body for more details
      let errorData: unknown = null;
      const contentType = response.headers.get('content-type');

      try {
        if (
          contentType?.includes('application/json') ||
          contentType?.includes('application/vnd.api+json')
        ) {
          errorData = await response.json();
        } else {
          errorData = await response.text();
        }
      } catch {
        // If parsing fails, continue with basic error
      }

      const errorObj = errorData as {
        errors?: Array<{detail?: string}>;
        message?: string;
      } | null;
      const errorMessage =
        errorObj?.errors?.[0]?.detail ||
        errorObj?.message ||
        `Request failed with status ${response.status}: ${response.statusText}`;

      const error = new ApiError(
        errorMessage,
        response.status,
        response.statusText,
        response
      );

      // Attach the error data for more context
      error.data = errorData;
      throw error;
    }

    // Parse successful response data
    let responseData: T;
    const contentType = response.headers.get('content-type');

    if (
      contentType?.includes('application/json') ||
      contentType?.includes('application/vnd.api+json')
    ) {
      responseData = await response.json();
    } else {
      responseData = (await response.text()) as unknown as T;
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
        const abortError = new ApiError('Request was cancelled', 0, 'Aborted');
        throw abortError;
      }
      const networkError = new ApiError(
        `Network error: ${error.message}`,
        0,
        'Network Error'
      );
      throw networkError;
    }

    const unknownError = new ApiError(
      'An unknown error occurred',
      0,
      'Unknown Error'
    );
    throw unknownError;
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
