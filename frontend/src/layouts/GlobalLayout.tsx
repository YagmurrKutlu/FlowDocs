import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';

export function GlobalLayout() {
  return (
    <AppShell
      padding={0}
      navbar={{ width: 270, breakpoint: 0 }}
      header={{ height: 74 }}
      styles={{
        main: {
          background:
            'linear-gradient(180deg, rgba(16,17,19,1) 0%, rgba(21,23,28,1) 100%)',
          minHeight: '100vh',
        },
        navbar: {
          backgroundColor: '#121317',
          borderRight: '1px solid #25262b',
        },
        header: {
          backgroundColor: '#121317',
          borderBottom: '1px solid #25262b',
        },
      }}
    >
      <AppShell.Navbar>
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Header>
        <Topbar />
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
