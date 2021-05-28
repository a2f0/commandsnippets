export declare const environment: () => 'staging' | 'production' | 'local';
export declare const baseHTTPURL: () =>
  | 'https://api-staging.tearleads.com'
  | 'https://api.tearleads.com'
  | 'http://localhost:9001';
declare const API: import('axios').AxiosInstance;
export default API;
