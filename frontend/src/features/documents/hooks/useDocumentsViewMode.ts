import { useCallback, useState } from 'react';

export type DocumentsDisplayMode = 'grid' | 'list';

const STORAGE_KEY = 'flowdocs.documents.viewMode';

function readStoredMode(): DocumentsDisplayMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function useDocumentsViewMode() {
  const [viewMode, setViewModeState] = useState<DocumentsDisplayMode>(readStoredMode);

  const setViewMode = useCallback((mode: DocumentsDisplayMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }, []);

  return { viewMode, setViewMode };
}
