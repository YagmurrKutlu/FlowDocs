export type ProfileUserRole = 'admin' | 'user';

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: ProfileUserRole;
  displayName: string;
  title: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  skills: string[];
}

export interface ProfileStats {
  documentCount: number;
  syncCount: number;
  workspaceCount: number;
  collaborationCount: number;
  totalEdits: number;
}

export interface ProfileActivity {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  documentId: string | null;
  documentTitle: string;
  timestamp: string;
  timeLabel: string;
}

export interface ProfileDocumentItem {
  id: string;
  title: string;
  workspaceName: string;
  memberCount: number;
  status: 'live' | 'offline';
  statusLabel: string;
  updatedAt: string;
  timeLabel: string;
}

export interface ProfileWorkspaceItem {
  id: string;
  name: string;
  memberCount: number;
  documentCount: number;
  role: string;
  roleLabel: string;
}

export interface ProfileNotifications {
  editNotifications: boolean;
  commentNotifications: boolean;
  userJoinedNotifications: boolean;
  emailSummary: boolean;
}

export interface ProfileAppearance {
  language: 'tr' | 'en';
  fontFamily: string;
}

export interface ProfileSecurity {
  jwtAuth: {
    label: string;
    status: string;
    detail: string;
  };
  twoFactor: {
    label: string;
    status: string;
    detail: string;
  };
  sessionsSummary: {
    label: string;
    detail: string;
  };
}

export interface ProfileSession {
  id: string;
  device: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  location: string;
  ipMasked: string;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastActiveLabel: string;
}

export interface MyProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  recentActivities: ProfileActivity[];
  documents: ProfileDocumentItem[];
  security: ProfileSecurity;
  sessions: ProfileSession[];
  notifications: ProfileNotifications;
  workspaces: ProfileWorkspaceItem[];
  appearance: ProfileAppearance;
}

export interface UpdateProfilePayload {
  displayName?: string;
  title?: string;
  bio?: string;
  location?: string;
  skills?: string[];
}
