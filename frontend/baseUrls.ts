// In local dev, '/api/' works because Vite proxies it to the backend
// (see vite.config.js). In production with split hosting (frontend on
// Netlify, backend on Render), set VITE_API_URL in Netlify's environment
// variables to your Render backend URL + '/api/', e.g.
//   https://your-backend.onrender.com/api/
//
// If VITE_API_URL is not set, falls back to the relative '/api/' path,
// which works IF you've also configured the netlify.toml redirect rule
// to proxy /api/* to your backend (see netlify.toml in this same bundle).
// Setting the env var directly is more reliable for file uploads than
// relying on Netlify's redirect rewriting.
export const BASE_URL = import.meta.env.VITE_API_URL || '/api/';
export const AUTH_URL = `${BASE_URL}user/`;

// Base URL for static assets served directly by the backend (uploaded
// media, decrypted-on-read files). Used anywhere the code builds an
// image/video/file src like `${MEDIA_BASE_URL}${media.url}`.
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_URL || '/';
