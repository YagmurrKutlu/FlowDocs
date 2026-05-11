export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface UserResponse {
  user: ApiUser;
}

export interface WorkspaceOwner {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  role: string;
  owner: WorkspaceOwner;
  memberCount: number;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceResponse {
  workspace: WorkspaceSummary;
}

export type AssignableWorkspaceRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface WorkspaceMemberRow {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMemberRow[];
}

export interface AddWorkspaceMemberPayload {
  email: string;
  role: AssignableWorkspaceRole;
}

export interface WorkspaceMemberMembership extends WorkspaceMemberRow {
  id: string;
}

export interface AddWorkspaceMemberResponse {
  membership: WorkspaceMemberMembership;
}
