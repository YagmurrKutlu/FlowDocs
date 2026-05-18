import { Button, Skeleton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { PendingInvitesCard } from '../components/PendingInvitesCard';
import { RolesPermissionsCard } from '../components/RolesPermissionsCard';
import { TeamActivityCard } from '../components/TeamActivityCard';
import { TeamDocumentsCard } from '../components/TeamDocumentsCard';
import { TeamHealthCard } from '../components/TeamHealthCard';
import { TeamHero } from '../components/TeamHero';
import { TeamMembersCard } from '../components/TeamMembersCard';
import { TeamStatsGrid } from '../components/TeamStatsGrid';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { useCreateWorkspaceModal } from '../hooks/useCreateWorkspaceModal';
import {
  useAcceptInviteDemoMutation,
  useCancelInviteMutation,
  useCreateInviteMutation,
  useRemoveMemberMutation,
  useTeamActivityQuery,
  useTeamDocumentsQuery,
  useTeamInvitesQuery,
  useTeamMembersQuery,
  useTeamOverviewQuery,
  useUpdateMemberRoleMutation,
} from '../hooks/useTeamQueries';
import { isWorkspaceOwner } from '../team.utils';
import type { WorkspaceRole } from '../types/team.types';
import styles from './TeamPage.module.css';

export function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const overviewQuery = useTeamOverviewQuery();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const workspaces = overviewQuery.data?.workspaces ?? [];

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(
        overviewQuery.data?.currentWorkspace?.id ?? workspaces[0].id,
      );
    }
  }, [overviewQuery.data, selectedWorkspaceId, workspaces]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const isOwner = isWorkspaceOwner(selectedWorkspace?.role);

  const membersQuery = useTeamMembersQuery(selectedWorkspaceId);
  const documentsQuery = useTeamDocumentsQuery(selectedWorkspaceId);
  const invitesQuery = useTeamInvitesQuery(selectedWorkspaceId, isOwner);
  const activityQuery = useTeamActivityQuery(selectedWorkspaceId);

  const createWorkspaceModal = useCreateWorkspaceModal({
    onCreated: (workspaceId) => setSelectedWorkspaceId(workspaceId),
  });
  const createInvite = useCreateInviteMutation(selectedWorkspaceId);
  const cancelInvite = useCancelInviteMutation(selectedWorkspaceId);
  const acceptInviteDemo = useAcceptInviteDemoMutation(selectedWorkspaceId);
  const updateRole = useUpdateMemberRoleMutation(selectedWorkspaceId);
  const removeMember = useRemoveMemberMutation(selectedWorkspaceId);

  const handleInvite = async (payload: { email: string; role: 'EDITOR' | 'VIEWER' }) => {
    try {
      await createInvite.mutateAsync(payload);
      notifications.show({
        title: 'Davet oluşturuldu',
        message: 'Davet kaydı oluşturuldu.',
        color: 'green',
      });
      setInviteOpen(false);
    } catch (error) {
      const message = getApiErrorMessage(error);
      notifications.show({
        title: 'Davet oluşturulamadı',
        message:
          message !== 'Something went wrong. Please try again.'
            ? message
            : 'Davet kaydı oluşturulurken bir hata oluştu.',
        color: 'red',
      });
    }
  };

  const handleRoleChange = async (memberId: string, role: WorkspaceRole) => {
    setRoleUpdatingId(memberId);
    try {
      await updateRole.mutateAsync({ memberId, role });
      notifications.show({ message: 'Üye rolü güncellendi.', color: 'green' });
    } catch {
      notifications.show({
        message: 'Rol güncellenemedi.',
        color: 'red',
      });
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeMember.mutateAsync(memberId);
      notifications.show({ message: 'Üye çıkarıldı.', color: 'green' });
    } catch {
      notifications.show({
        message: 'Üye çıkarılamadı.',
        color: 'red',
      });
    } finally {
      setRemovingId(null);
    }
  };

  const pendingInvites = invitesQuery.data?.invites ?? [];
  const showDemoAccept = import.meta.env.DEV && isOwner;

  const handleAcceptInviteDemo = async (inviteId: string) => {
    setAcceptingId(inviteId);
    try {
      await acceptInviteDemo.mutateAsync(inviteId);
      notifications.show({
        message: 'Davet kabul edildi ve üye eklendi.',
        color: 'green',
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      notifications.show({
        title: 'Davet kabul edilemedi',
        message:
          message !== 'Something went wrong. Please try again.'
            ? message
            : 'Davet kabul edilemedi.',
        color: 'red',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingId(inviteId);
    try {
      await cancelInvite.mutateAsync(inviteId);
      notifications.show({ message: 'Davet iptal edildi.', color: 'green' });
    } catch {
      notifications.show({
        message: 'Davet iptal edilemedi.',
        color: 'red',
      });
    } finally {
      setCancellingId(null);
    }
  };

  if (overviewQuery.isError) {
    return (
      <main className={styles.page}>
        <div className={styles.errorState}>
          <p>Ekip bilgileri yüklenemedi.</p>
          <Button mt="md" onClick={() => overviewQuery.refetch()}>
            Yeniden dene
          </Button>
        </div>
      </main>
    );
  }

  const stats = overviewQuery.data?.stats;

  return (
    <main className={styles.page}>
      <TeamHero
        canInvite={isOwner && Boolean(selectedWorkspaceId)}
        onInvite={() => setInviteOpen(true)}
        onNewWorkspace={createWorkspaceModal.open}
      />

      <TeamStatsGrid
        loading={overviewQuery.isLoading}
        totalWorkspaces={stats?.totalWorkspaces ?? 0}
        totalMembers={stats?.totalMembers ?? 0}
        totalDocuments={stats?.totalDocuments ?? 0}
        activeCollaborators={stats?.activeCollaborators ?? null}
      />

      {overviewQuery.isLoading ? (
        <section className={styles.contentGrid}>
          <Skeleton height={320} radius={14} />
        </section>
      ) : (
        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <WorkspaceSwitcher
              workspaces={workspaces}
              selectedId={selectedWorkspaceId}
              loading={false}
              onSelect={setSelectedWorkspaceId}
            />
            <TeamMembersCard
              members={membersQuery.data?.members ?? []}
              pendingInviteCount={pendingInvites.length}
              loading={membersQuery.isLoading}
              isOwner={isOwner}
              currentUserId={user?.id}
              roleUpdatingId={roleUpdatingId}
              removingId={removingId}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
            {isOwner ? (
              <PendingInvitesCard
                invites={pendingInvites}
                loading={invitesQuery.isLoading}
                cancellingId={cancellingId}
                acceptingId={acceptingId}
                showDemoAccept={showDemoAccept}
                onCancel={handleCancelInvite}
                onAcceptDemo={handleAcceptInviteDemo}
              />
            ) : null}
            <TeamDocumentsCard
              documents={documentsQuery.data?.documents ?? []}
              loading={documentsQuery.isLoading}
            />
          </div>

          <aside className={styles.sideColumn}>
            <RolesPermissionsCard />
            <TeamHealthCard
              workspace={selectedWorkspace}
              pendingInviteCount={invitesQuery.data?.invites.length ?? 0}
              loading={overviewQuery.isLoading}
            />
            <TeamActivityCard
              activities={activityQuery.data?.activities ?? []}
              loading={activityQuery.isLoading}
            />
          </aside>
        </section>
      )}

      <InviteMemberModal
        opened={inviteOpen}
        loading={createInvite.isPending}
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
      />

      <CreateWorkspaceModal
        opened={createWorkspaceModal.opened}
        loading={createWorkspaceModal.isPending}
        onClose={createWorkspaceModal.close}
        onSubmit={createWorkspaceModal.handleSubmit}
      />
    </main>
  );
}
