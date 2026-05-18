import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptWorkspaceInviteDemo,
  cancelWorkspaceInvite,
  createWorkspace,
  createWorkspaceInvite,
  fetchTeamOverview,
  fetchWorkspaceActivity,
  fetchWorkspaceDocuments,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../api/team.api';
import { documentsQueryKeys } from '../../documents/hooks/useDocumentsQueries';
import type {
  CreateWorkspaceInvitePayload,
  WorkspaceRole,
} from '../types/team.types';

export const teamQueryKeys = {
  overview: () => ['team', 'overview'] as const,
  members: (workspaceId: string) =>
    ['team', workspaceId, 'members'] as const,
  documents: (workspaceId: string) =>
    ['team', workspaceId, 'documents'] as const,
  invites: (workspaceId: string) =>
    ['team', workspaceId, 'invites'] as const,
  activity: (workspaceId: string) =>
    ['team', workspaceId, 'activity'] as const,
};

export function useCreateWorkspaceMutation(options?: {
  onCreated?: (workspaceId: string) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createWorkspace({ name }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: teamQueryKeys.overview(),
      });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.all });
      options?.onCreated?.(data.workspace.id);
    },
  });
}

export function useTeamOverviewQuery() {
  return useQuery({
    queryKey: teamQueryKeys.overview(),
    queryFn: fetchTeamOverview,
  });
}

export function useTeamMembersQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: teamQueryKeys.members(workspaceId ?? ''),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useTeamDocumentsQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: teamQueryKeys.documents(workspaceId ?? ''),
    queryFn: () => fetchWorkspaceDocuments(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useTeamInvitesQuery(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: teamQueryKeys.invites(workspaceId ?? ''),
    queryFn: () => fetchWorkspaceInvites(workspaceId!),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useTeamActivityQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: teamQueryKeys.activity(workspaceId ?? ''),
    queryFn: () => fetchWorkspaceActivity(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateInviteMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkspaceInvitePayload) =>
      createWorkspaceInvite(workspaceId!, payload),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.invites(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.activity(workspaceId),
        });
      }
    },
  });
}

export function useCancelInviteMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      cancelWorkspaceInvite(workspaceId!, inviteId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.invites(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.overview(),
        });
      }
    },
  });
}

export function useAcceptInviteDemoMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      acceptWorkspaceInviteDemo(workspaceId!, inviteId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.members(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.invites(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.overview(),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.activity(workspaceId),
        });
      }
    },
  });
}

export function useUpdateMemberRoleMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: WorkspaceRole;
    }) => updateWorkspaceMemberRole(workspaceId!, memberId, role),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.members(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.overview(),
        });
      }
    },
  });
}

export function useRemoveMemberMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      removeWorkspaceMember(workspaceId!, memberId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.members(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: teamQueryKeys.overview(),
        });
      }
    },
  });
}
