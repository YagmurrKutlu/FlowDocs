import { AppShell } from '@mantine/core';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '../components/app-sidebar/AppSidebar';
import { useSidebarCollapsed } from '../components/app-sidebar/hooks/useSidebarCollapsed';
import { Topbar } from '../components/navigation/Topbar';

const EXPANDED_NAV = 265;
const COLLAPSED_NAV = 78;

export function GlobalLayout() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const location = useLocation();
  const isDashboardHome = location.pathname === '/dashboard';

  return (
    <AppShell
      padding={0}
      navbar={{ width: collapsed ? COLLAPSED_NAV : EXPANDED_NAV, breakpoint: 0 }}
      header={isDashboardHome ? { height: 0 } : { height: 72 }}
      transitionDuration={220}
      transitionTimingFunction="ease"
      styles={{
        main: {
          background: 'var(--fd-surface-app)',
          minHeight: '100vh',
        },
        navbar: {
          backgroundColor: 'var(--fd-surface-sidebar)',
          borderRight: '1px solid var(--fd-border-subtle)',
        },
        header: {
          backgroundColor: 'var(--fd-surface-app)',
          borderBottom: '1px solid var(--fd-border-subtle)',
        },
      }}
    >
      <AppShell.Navbar>
        <AppSidebar collapsed={collapsed} onToggleCollapse={toggle} />
      </AppShell.Navbar>

      {!isDashboardHome ? (
        <AppShell.Header>
          <Topbar />
        </AppShell.Header>
      ) : null}

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
