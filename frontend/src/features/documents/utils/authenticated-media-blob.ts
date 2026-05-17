import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import { isBrowserAuthenticatedMediaUrl } from './confirm-media-url';

export async function fetchAuthenticatedMediaBlob(src: string): Promise<Blob> {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error('Oturum bulunamadı');
  }
  const response = await fetch(src, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.blob();
}

function openUrlInNewTab(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function openAuthenticatedMediaInNewTab(src: string): Promise<void> {
  if (!isBrowserAuthenticatedMediaUrl(src)) {
    openUrlInNewTab(src);
    return;
  }
  const blob = await fetchAuthenticatedMediaBlob(src);
  const objectUrl = URL.createObjectURL(blob);
  openUrlInNewTab(objectUrl);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadAuthenticatedMedia(
  src: string,
  fileName: string,
): Promise<void> {
  const blob = isBrowserAuthenticatedMediaUrl(src)
    ? await fetchAuthenticatedMediaBlob(src)
    : await fetch(src).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function useAuthenticatedMediaObjectUrl(
  src: string | null | undefined,
  enabled: boolean,
  expectedMimeType?: string,
): {
  objectUrl: string | null;
  loading: boolean;
  error: string | null;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !src?.trim()) {
      setObjectUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setObjectUrl(null);
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const blob = isBrowserAuthenticatedMediaUrl(src)
          ? await fetchAuthenticatedMediaBlob(src)
          : await fetch(src).then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.blob();
            });

        if (expectedMimeType && blob.type && blob.type !== expectedMimeType) {
          throw new Error('Beklenmeyen dosya türü');
        }

        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch {
        if (!cancelled) {
          setError('Önizleme yüklenemedi.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!accessToken && isBrowserAuthenticatedMediaUrl(src)) {
      setError('Oturum bulunamadı.');
      setLoading(false);
      return;
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [accessToken, enabled, expectedMimeType, src]);

  return { objectUrl, loading, error };
}
