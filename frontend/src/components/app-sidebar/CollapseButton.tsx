import { ActionIcon, Tooltip } from '@mantine/core';
import { IconLayoutSidebarLeftExpand, IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';

type CollapseButtonProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function CollapseButton({ collapsed, onToggle }: CollapseButtonProps) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const Icon = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse;

  return (
    <Tooltip label={label} position="right" withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        radius="md"
        onClick={onToggle}
        aria-label={label}
      >
        <Icon size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
