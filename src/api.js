import axios from "axios";

export const baseHTTPURL = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return 'https://api-staging.tearleads.com';
  } else {
    return "http://localhost:9001";
  }  
}

const baseAPIURL = () => {
  return baseHTTPURL() + '/api/v1';
}

const API = axios.create({
  baseURL: baseAPIURL(),
  responseType: "json",
  headers: {
    'Content-Type': 'application/vnd.api+json'
  },
});

export default API