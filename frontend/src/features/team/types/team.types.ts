export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type TeamWorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
  documentCount: number;
  updatedAt: string;
};

export type TeamOverviewResponse = {
  workspaces: TeamWorkspaceSummary[];
  currentWorkspace: TeamWorkspaceSummary | null;
  stats: {
    totalWorkspaces: number;
    totalMembers: number;
    totalDocuments: number;
    activeCollaborators: number | null;
  };
};

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  lastActiveAt: string | null;
  status: 'unknown';
};

export type TeamMembersResponse = {
  members: TeamMember[];
};

export type TeamDocument = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  status: string;
};

export type TeamDocumentsResponse = {
  documents: TeamDocument[];
};

export type TeamInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  createdAt: string;
  invitedBy: { id: string; name: string; email: string };
};

export type TeamInvitesResponse = {
  invites: TeamInvite[];
};

export type TeamActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  actorName: string;
  createdAt: string;
};

export type TeamActivityResponse = {
  activities: TeamActivity[];
};

export type CreateWorkspaceInvitePayload = {
  email: string;
  role: 'EDITOR' | 'VIEWER';
};

export type CreateWorkspacePayload = {
  name: string;
};

export type CreateWorkspaceResponse = {
  workspace: TeamWorkspaceSummary;
};

export type AcceptInviteDemoResponse = {
  member: TeamMember;
  invite: Pick<TeamInvite, 'id' | 'email' | 'role' | 'status' | 'createdAt'>;
};
