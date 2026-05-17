import { apiClient } from '../../../shared/api/client';
import type {
  AcceptInviteDemoResponse,
  CreateWorkspaceInvitePayload,
  CreateWorkspacePayload,
  CreateWorkspaceResponse,
  TeamActivityResponse,
  TeamDocumentsResponse,
  TeamInvitesResponse,
  TeamMembersResponse,
  TeamOverviewResponse,
  WorkspaceRole,
} from '../types/team.types';

export async function fetchTeamOverview(): Promise<TeamOverviewResponse> {
  const { data } = await apiClient.get<TeamOverviewResponse>('/team/overview');
  return data;
}

export async function createWorkspace(
  payload: CreateWorkspacePayload,
): Promise<CreateWorkspaceResponse> {
  const { data } = await apiClient.post<CreateWorkspaceResponse>(
    '/team/workspaces',
    payload,
  );
  return data;
}

export async function fetchWorkspaceMembers(
  workspaceId: string,
): Promise<TeamMembersResponse> {
  const { data } = await apiClient.get<TeamMembersResponse>(
    `/team/workspaces/${workspaceId}/members`,
  );
  return data;
}

export async function fetchWorkspaceDocuments(
  workspaceId: string,
): Promise<TeamDocumentsResponse> {
  const { data } = await apiClient.get<TeamDocumentsResponse>(
    `/team/workspaces/${workspaceId}/documents`,
  );
  return data;
}

export async function fetchWorkspaceInvites(
  workspaceId: string,
): Promise<TeamInvitesResponse> {
  const { data } = await apiClient.get<TeamInvitesResponse>(
    `/team/workspaces/${workspaceId}/invites`,
  );
  return data;
}

export async function createWorkspaceInvite(
  workspaceId: string,
  payload: CreateWorkspaceInvitePayload,
): Promise<{ invite: TeamInvitesResponse['invites'][number] }> {
  const { data } = await apiClient.post<{ invite: TeamInvitesResponse['invites'][number] }>(
    `/team/workspaces/${workspaceId}/invites`,
    payload,
  );
  return data;
}

export async function cancelWorkspaceInvite(
  workspaceId: string,
  inviteId: string,
): Promise<void> {
  await apiClient.delete(
    `/team/workspaces/${workspaceId}/invites/${inviteId}`,
  );
}

export async function acceptWorkspaceInviteDemo(
  workspaceId: string,
  inviteId: string,
): Promise<AcceptInviteDemoResponse> {
  const { data } = await apiClient.post<AcceptInviteDemoResponse>(
    `/team/workspaces/${workspaceId}/invites/${inviteId}/accept-demo`,
  );
  return data;
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<void> {
  await apiClient.patch(
    `/team/workspaces/${workspaceId}/members/${memberId}/role`,
    { role },
  );
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
): Promise<void> {
  await apiClient.delete(
    `/team/workspaces/${workspaceId}/members/${memberId}`,
  );
}

export async function fetchWorkspaceActivity(
  workspaceId: string,
): Promise<TeamActivityResponse> {
  const { data } = await apiClient.get<TeamActivityResponse>(
    `/team/workspaces/${workspaceId}/activity`,
  );
  return data;
}
