import { Box, NavLink, Tooltip } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SidebarNavKey } from './nav-matcher';
import { isSidebarNavActive, sidebarNavHref } from './nav-matcher';
import styles from './SidebarNavItem.module.css';

const activeRoot = {
  background: 'var(--fd-nav-active-bg)',
  border: '1px solid var(--fd-nav-active-border)',
  borderRadius: 10,
  color: 'var(--fd-nav-active-text)',
} as const;

const inactiveHover = {
  background: 'var(--fd-nav-hover-bg)',
  color: 'var(--fd-nav-hover-text)',
} as const;

export type SidebarNavItemProps = {
  navKey: SidebarNavKey;
  label: string;
  icon: TablerIcon;
  collapsed: boolean;
  badge?: number | null;
};

export function SidebarNavItem({
  navKey,
  label,
  icon: Icon,
  collapsed,
  badge,
}: SidebarNavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const active = isSidebarNavActive(navKey, location);
  const href = sidebarNavHref(navKey);

  const iconColor =
    active || hovered ? 'var(--fd-nav-hover-text)' : 'var(--fd-nav-idle-text)';
  const textColor = active
    ? 'var(--fd-nav-active-text)'
    : hovered
      ? 'var(--fd-nav-hover-text)'
      : 'var(--fd-nav-idle-text)';

  const badgeNode =
    !collapsed && active && badge != null && badge > 0 ? (
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
          padding: '2px 8px',
          borderRadius: 8,
          lineHeight: 1.3,
          boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset',
        }}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    ) : undefined;

  const link = (
    <Box
      component="div"
      className={`${styles.shell} ${active ? styles.shellActive : ''}`}
      style={{ overflow: 'visible' }}
    >
      <NavLink
        active={active}
        classNames={{ root: styles.navRoot }}
        label={collapsed ? undefined : label}
        leftSection={
          <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
            <Icon size={18} stroke={1.75} />
          </span>
        }
        rightSection={badgeNode}
        onClick={(e) => {
          e.preventDefault();
          navigate(href);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        variant="subtle"
        color="gray"
        styles={{
          root: {
            borderRadius: 10,
            border: active ? activeRoot.border : '1px solid transparent',
            background: active
              ? activeRoot.background
              : hovered
                ? inactiveHover.background
                : 'transparent',
            color: textColor,
            boxShadow: 'none',
            justifyContent: collapsed ? 'center' : undefined,
            transition: active
              ? 'background 120ms ease, color 120ms ease, border-color 120ms ease'
              : 'background 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
          },
          section: {
            marginRight: collapsed ? 0 : undefined,
          },
          label: {
            color: collapsed ? undefined : textColor,
          },
        }}
      />
    </Box>
  );

  if (collapsed) {
    const tip =
      badge != null && badge > 0 && active ? `${label} (${badge})` : label;
    return (
      <Tooltip label={tip} position="right" withArrow>
        {link}
      </Tooltip>
    );
  }

  return link;
}
