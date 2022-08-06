import axios from 'axios';

import {environment} from './lib/environment';

export const baseHTTPURL = () => {
  if (environment === 'staging') {
    return 'https://api-staging.tearleads.com';
  } else if (environment === 'production') {
    return 'https://api.tearleads.com';
  } else {
    return 'http://localhost:9001';
  }
};

const baseAPIURL = () => {
  return baseHTTPURL() + '/api/v1';
};

const API = axios.create({
  baseURL: baseAPIURL(),
  responseType: 'json',
  headers: {
    'Content-Type': 'application/vnd.api+json',
  },
});

API.interceptors.response.use(
  response => response,
  error => {
    console.error(error);
    throw error;
  }
);

export default API;
