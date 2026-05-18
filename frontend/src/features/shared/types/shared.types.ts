export type SharedSort = 'recent' | 'updated' | 'title';
export type SharedTab = 'with-me' | 'by-me';
export type SharedRoleFilter = 'OWNER' | 'EDITOR' | 'VIEWER' | '';

export interface SharedOwner {
  id: string;
  name: string;
  email: string;
}

export interface SharedWithMeDocument {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  owner: SharedOwner;
  myRole: string;
  memberCount: number;
  updatedAt: string;
  sharedAt: string;
  previewContent: unknown;
  isFavorite: boolean;
}

export interface SharedByMeDocument {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  sharedUserCount: number;
  editorCount: number;
  viewerCount: number;
  updatedAt: string;
  createdAt: string;
  previewContent: unknown;
  isFavorite: boolean;
}

export interface SharedWithMeResponse {
  documents: SharedWithMeDocument[];
}

export interface SharedByMeResponse {
  documents: SharedByMeDocument[];
}

export interface SharedSummaryResponse {
  withMeCount: number;
  byMeCount: number;
  editorAccessCount: number;
  viewerAccessCount: number;
  workspaceCount: number;
  recentlyUpdatedCount: number;
}

export interface SharedWithMeParams {
  search?: string;
  workspaceId?: string;
  role?: 'OWNER' | 'EDITOR' | 'VIEWER';
  sort?: SharedSort;
}

export interface SharedByMeParams {
  search?: string;
  workspaceId?: string;
  sort?: SharedSort;
}
