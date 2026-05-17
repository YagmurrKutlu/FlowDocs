import type { Location } from 'react-router-dom';

export type SidebarNavKey =
  | 'dashboard'
  | 'documents-mine'
  | 'documents-shared'
  | 'documents-favorites'
  | 'documents-trash'
  | 'team'
  | 'settings'
  | 'profile';

export function sidebarNavHref(key: SidebarNavKey): string {
  switch (key) {
    case 'dashboard':
      return '/dashboard';
    case 'documents-mine':
      return '/documents';
    case 'documents-shared':
      return '/documents?view=shared';
    case 'documents-favorites':
      return '/documents?view=favorites';
    case 'documents-trash':
      return '/documents?view=trash';
    case 'team':
      return '/team';
    case 'settings':
      return '/settings';
    case 'profile':
      return '/profile';
  }
}

export function isSidebarNavActive(
  key: SidebarNavKey,
  loc: Pick<Location, 'pathname' | 'search'>,
): boolean {
  const q = new URLSearchParams(loc.search);
  const view = q.get('view');
  switch (key) {
    case 'dashboard':
      return loc.pathname === '/dashboard';
    case 'team':
      return loc.pathname === '/team';
    case 'documents-mine':
      if (!loc.pathname.startsWith('/documents')) return false;
      return view == null || view === '';
    case 'documents-shared':
      return loc.pathname.startsWith('/documents') && view === 'shared';
    case 'documents-favorites':
      return loc.pathname.startsWith('/documents') && view === 'favorites';
    case 'documents-trash':
      return loc.pathname.startsWith('/documents') && view === 'trash';
    case 'settings':
      return loc.pathname === '/settings';
    case 'profile':
      return loc.pathname === '/profile';
  }
}
