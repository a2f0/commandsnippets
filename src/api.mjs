export function constructApiUrl() {
  if (window.location.hostname === 'staging.tearleads.com') {
    return 'https://api-staging.tearleads.com';
  } else {
    return 'http://localhost:9001';
  }  
}
export default constructApiUrl;