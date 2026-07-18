// API URL: uses VITE_API_URL environment variable in production (Netlify),
// falls back to same-host:5000/api for local development.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes('netlify.app')
    ? 'https://ksb-poss-production.up.railway.app/api'
    : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://' + window.location.hostname + ':5000/api'
    : 'https://' + window.location.hostname + '/api');
