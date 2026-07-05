export const BASE_URL = import.meta.env.VITE_API_URL || '/api/';
export const AUTH_URL = `${BASE_URL}user/`;
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_URL || '/';

/**
 * Resolve a media URL for display.
 * - Optimistic messages store blob: URLs from URL.createObjectURL() — return as-is.
 * - Server-persisted messages store relative paths like "uploads/abc.webm" — prepend BASE_URL.
 * - Already-absolute http(s): URLs (e.g. CDN links) — return as-is.
 */
export const resolveMediaUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${BASE_URL}${url}`;
};