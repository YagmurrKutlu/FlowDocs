import { Avatar, Box, Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../store/auth.store';

type SidebarUserCardProps = {
  user: AuthUser | null;
  collapsed: boolean;
  roleLabel?: string;
};

function initialsFrom(full?: string | null) {
  if (!full) return 'U';
  const p = full.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) {
    return `${p[0].slice(0, 1)}${p[1].slice(0, 1)}`.toUpperCase();
  }
  return full.trim().slice(0, 2).toUpperCase() || 'U';
}

function shortDisplayName(full?: string | null) {
  if (!full) return 'Kullanıcı';
  const p = full.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]} ${p[1].slice(0, 1)}.`;
  return p[0];
}

export function SidebarUserCard({ user, collapsed, roleLabel = 'Üye' }: SidebarUserCardProps) {
  const navigate = useNavigate();
  const initials = initialsFrom(user?.fullName);
  const name = shortDisplayName(user?.fullName);
  const role = roleLabel;

  const goProfile = () => {
    navigate('/profile');
  };

  const avatar = (
    <Avatar src={user?.avatarUrl ?? undefined} radius="xl" size={collapsed ? 36 : 40}>
      {initials}
    </Avatar>
  );

  if (collapsed) {
    return (
      <Box ta="center" py={4}>
        <Tooltip label={`${name}\n${role}\nProfil`} multiline position="right" withArrow>
          <UnstyledButton
            onClick={goProfile}
            aria-label="Profil"
            style={{ borderRadius: 12, padding: 4 }}
          >
            {avatar}
          </UnstyledButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <UnstyledButton
      onClick={goProfile}
      w="100%"
      aria-label="Profil sayfasına git"
      style={{
        borderRadius: 12,
        textAlign: 'left',
        padding: '10px 8px',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--fd-sidebar-user-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={8}>
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar src={user?.avatarUrl ?? undefined} radius="xl" size={40}>
            {initials}
          </Avatar>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" lineClamp={1} c="var(--text-primary)">
              {name}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {role}
            </Text>
          </Stack>
        </Group>
        <Box
          mt={4}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 8px rgba(74, 222, 128, 0.55)',
            flexShrink: 0,
          }}
          aria-hidden
        />
      </Group>
    </UnstyledButton>
  );
}
