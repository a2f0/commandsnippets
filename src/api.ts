import axios from 'axios';
export const environment = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return 'staging';
  } else if (window.location.hostname === 'tearleads.com') {
    return 'production';
  } else if (
    window.location.hostname === 'localhost' &&
    window.location.port === '8080'
  ) {
    return 'development';
  } else if (
    window.location.hostname === 'localhost' &&
    window.location.port === '8081'
  ) {
    return 'test';
  } else {
    throw 'Unknown Tearleads environment';
  }
};

export const baseHTTPURL = () => {
  if (environment() === 'staging') {
    return 'https://api-staging.tearleads.com';
  } else if (environment() === 'production') {
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
