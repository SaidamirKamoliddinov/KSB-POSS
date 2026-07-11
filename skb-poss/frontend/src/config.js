// API URL: uses VITE_API_URL environment variable in production (Netlify),
// falls back to same-host:5000/api for local development.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://' + window.location.hostname + ':5000/api';
