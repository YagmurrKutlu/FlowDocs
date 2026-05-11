import { Badge, Group, Text, Title } from '@mantine/core';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Workspace Overview',
    subtitle: 'Track your workspaces and account status.',
  },
  '/documents': {
    title: 'Documents',
    subtitle: 'Document management will expand in the next phase.',
  },
  '/profile': {
    title: 'Profile',
    subtitle: 'Manage your personal account settings.',
  },
};

export function Topbar() {
  const location = useLocation();
  const path = location.pathname;

  let page =
    pageTitles[path] ?? {
      title: 'FlowDocs',
      subtitle: 'Collaborative workspace foundation.',
    };

  if (path.startsWith('/documents/') && path !== '/documents') {
    page = {
      title: 'Document',
      subtitle: 'Document details, members, and metadata.',
    };
  }

  return (
    <Group justify="space-between" px="lg" py="md">
      <div>
        <Title order={3}>{page.title}</Title>
        <Text c="dimmed" size="sm">
          {page.subtitle}
        </Text>
      </div>

      <Badge color="violet" variant="light">
        Day 2 foundation
      </Badge>
    </Group>
  );
}
