import { Box, Stack, Text } from '@mantine/core';
import type { PropsWithChildren } from 'react';

type SidebarSectionProps = PropsWithChildren<{
  label?: string;
  collapsed: boolean;
}>;

export function SidebarSection({ label, collapsed, children }: SidebarSectionProps) {
  return (
    <Stack gap={6}>
      {!collapsed && label ? (
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" px={4}>
          {label}
        </Text>
      ) : null}
      <Box>{children}</Box>
    </Stack>
  );
}
