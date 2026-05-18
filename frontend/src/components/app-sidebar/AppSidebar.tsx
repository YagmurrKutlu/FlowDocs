import { Box, Group, Stack, Text } from '@mantine/core';
import {
  IconBuildingCommunity,
  IconFolder,
  IconHome,
  IconSettings,
  IconStar,
  IconTrash,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../../shared/api/client';
import type { WorkspaceListResponse } from '../../shared/api/contracts';
import { useDocumentsListQuery } from '../../features/documents/hooks/useDocumentsQueries';
import { useTrashSummaryQuery } from '../../features/trash/hooks/useTrashQueries';
import { useAuthStore } from '../../store/auth.store';
import { CollapseButton } from './CollapseButton';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { SidebarUserCard } from './SidebarUserCard';
import styles from './AppSidebar.module.css';

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function isLiveRecently(iso: string, hours: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hours * 3600000;
}

function mapWorkspaceRole(role: string | undefined): string {
  if (!role) return 'Üye';
  const r = role.toUpperCase();
  if (r === 'OWNER' || r === 'ADMIN') return 'Admin';
  if (r === 'EDITOR') return 'Editör';
  if (r === 'VIEWER') return 'İzleyici';
  return role;
}

export function AppSidebar({ collapsed, onToggleCollapse }: AppSidebarProps) {
  const user = useAuthStore((state) => state.user);
  const listQuery = useDocumentsListQuery();
  const trashSummaryQuery = useTrashSummaryQuery();
  const documents = listQuery.data?.documents ?? [];
  const trashBadge = trashSummaryQuery.data?.deletedDocumentCount ?? 0;

  const liveBadge = useMemo(
    () => documents.filter((d) => isLiveRecently(d.updatedAt, 72)).length,
    [documents],
  );

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkspaceListResponse>('/workspaces');
      return data;
    },
  });

  const roleLabel = useMemo(() => {
    const first = workspacesQuery.data?.workspaces?.[0];
    return mapWorkspaceRole(first?.role);
  }, [workspacesQuery.data]);

  return (
    <Box component="aside" className={styles.root} h="100%" px={collapsed ? 8 : 14} py={16}>
      <Box className={styles.mainColumn}>
        <Box className={styles.logoSlot}>
          {!collapsed ? (
            <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
              <div className={styles.logoCluster}>
                <img
                  src={`${import.meta.env.BASE_URL}flowdocs_icon.svg`}
                  alt=""
                  width={28}
                  height={28}
                  className={styles.logoMark}
                  decoding="async"
                />
                <Text fw={700} size="lg" c="#fff" style={{ letterSpacing: '-0.02em' }}>
                  FlowDocs
                </Text>
              </div>
              <CollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
            </Group>
          ) : (
            <Stack gap={8} align="center">
              <img
                src={`${import.meta.env.BASE_URL}flowdocs_icon.svg`}
                alt="FlowDocs"
                width={28}
                height={28}
                className={styles.logoMark}
                decoding="async"
              />
              <CollapseButton collapsed={collapsed} onToggle={onToggleCollapse} />
            </Stack>
          )}
        </Box>

        <Box className={styles.menuBlock}>
          <Stack gap="xl">
            <SidebarSection label="ANA MENÜ" collapsed={collapsed}>
              <Stack gap={4}>
                <SidebarNavItem
                  navKey="dashboard"
                  label="Dashboard"
                  icon={IconHome}
                  collapsed={collapsed}
                  badge={liveBadge}
                />
                <SidebarNavItem
                  navKey="documents-mine"
                  label="Dokümanlarım"
                  icon={IconFolder}
                  collapsed={collapsed}
                />
                <SidebarNavItem
                  navKey="documents-shared"
                  label="Paylaşılanlar"
                  icon={IconUsers}
                  collapsed={collapsed}
                />
                <SidebarNavItem
                  navKey="documents-favorites"
                  label="Favoriler"
                  icon={IconStar}
                  collapsed={collapsed}
                />
                <SidebarNavItem
                  navKey="documents-trash"
                  label="Çöp Kutusu"
                  icon={IconTrash}
                  collapsed={collapsed}
                  badge={trashBadge > 0 ? trashBadge : null}
                />
              </Stack>
            </SidebarSection>

            <SidebarSection label="ÇALIŞMA ALANI" collapsed={collapsed}>
              <Stack gap={4}>
                <SidebarNavItem
                  navKey="team"
                  label="Ekibim"
                  icon={IconBuildingCommunity}
                  collapsed={collapsed}
                />
                <SidebarNavItem
                  navKey="settings"
                  label="Ayarlar"
                  icon={IconSettings}
                  collapsed={collapsed}
                />
                <SidebarNavItem
                  navKey="profile"
                  label="Profil"
                  icon={IconUserCircle}
                  collapsed={collapsed}
                />
              </Stack>
            </SidebarSection>
          </Stack>
        </Box>

        <Box className={styles.footer}>
          <SidebarUserCard user={user} collapsed={collapsed} roleLabel={roleLabel} />
        </Box>
      </Box>
    </Box>
  );
}
