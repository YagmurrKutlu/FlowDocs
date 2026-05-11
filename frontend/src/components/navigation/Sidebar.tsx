import { Avatar, Button, NavLink, Stack, Text } from '@mantine/core';
import {
  IconDashboard,
  IconFileText,
  IconUserCircle,
  IconLogout,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

const items = [
  { label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
  { label: 'Documents', to: '/documents', icon: IconFileText },
  { label: 'Profile', to: '/profile', icon: IconUserCircle },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return (
    <Stack gap="xl" p="md" h="100%">
      <Text fw={700} size="xl" c="violet.3">
        FlowDocs
      </Text>

      <Stack gap={4}>
        <Avatar src={user?.avatarUrl ?? undefined} radius="xl">
          {user?.fullName?.slice(0, 1) ?? 'U'}
        </Avatar>
        <Text fw={600}>{user?.fullName ?? 'Workspace user'}</Text>
        <Text size="sm" c="dimmed">
          {user?.email ?? 'session@flowdocs.app'}
        </Text>
      </Stack>

      <Stack gap="xs">
        {items.map((item) => (
          <NavLink
            key={item.to}
            active={location.pathname.startsWith(item.to)}
            label={item.label}
            leftSection={<item.icon size={18} />}
            onClick={() => navigate(item.to)}
            variant="filled"
          />
        ))}
      </Stack>

      <Button
        mt="auto"
        variant="light"
        color="red"
        leftSection={<IconLogout size={16} />}
        onClick={() => {
          clearAuth();
          navigate('/login', { replace: true });
        }}
      >
        Sign out
      </Button>
    </Stack>
  );
}
