import type { ConfirmDocumentMediaResponse } from '../types/document.types';

type LooseMedia = {
  url?: unknown;
  publicUrl?: unknown;
  downloadUrl?: unknown;
  objectUrl?: unknown;
};

/** Picks the first non-empty URL field from a confirm response (handles API shape drift). */
export function resolveConfirmMediaUrl(confirm: ConfirmDocumentMediaResponse): string {
  const m = confirm.media as LooseMedia;
  const candidates = [m.url, m.publicUrl, m.downloadUrl, m.objectUrl];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return '';
}

const DOCUMENT_MEDIA_FILE_PATH_RE = /\/documents\/[^/]+\/media\/[^/]+\/file$/;

/** True when the URL is our JWT-protected media file route (must be loaded with Authorization, e.g. via blob fetch). */
export function isBrowserAuthenticatedMediaUrl(src: string): boolean {
  const t = src.trim();
  if (!t) return false;
  try {
    const pathname = new URL(t).pathname;
    return DOCUMENT_MEDIA_FILE_PATH_RE.test(pathname);
  } catch {
    try {
      const pathname = new URL(t, 'http://local.invalid').pathname;
      return DOCUMENT_MEDIA_FILE_PATH_RE.test(pathname);
    } catch {
      return false;
    }
  }
}
