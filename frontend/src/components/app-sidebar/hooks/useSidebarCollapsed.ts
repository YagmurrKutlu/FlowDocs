import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'flowdocs.sidebar.collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(() => readCollapsed());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsedState((c) => !c);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
  }, []);

  return { collapsed, toggle, setCollapsed };
}
