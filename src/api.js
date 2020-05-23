import axios from "axios";

function baseURL() {
  if (window.location.hostname === 'staging.tearleads.com') {
    return 'https://api-staging.tearleads.com';
  } else {
    return "http://localhost:9001/api/v1";
  }  
}

export default axios.create({
  baseURL: baseURL(),
  responseType: "json"
});