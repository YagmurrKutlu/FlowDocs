export type TrashDocumentSort = 'newest' | 'oldest' | 'title';

export interface TrashSummaryResponse {
  deletedDocumentCount: number;
  restorableCount: number;
  oldestDeletedAt: string | null;
  retentionPolicyDays: number;
}

export interface TrashDeletedBy {
  id: string;
  name: string;
  email: string;
}

export interface TrashDocumentItem {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  deletedAt: string;
  deletedBy: TrashDeletedBy | null;
  lastUpdatedAt: string;
  memberCount: number;
  daysSinceDeleted: number;
  daysUntilPolicyLimit: number;
}

export interface TrashDocumentsResponse {
  documents: TrashDocumentItem[];
}

export interface TrashDocumentsParams {
  search?: string;
  workspaceId?: string;
  sort?: TrashDocumentSort;
}

export interface RestoreTrashDocumentResponse {
  message: string;
  document: { id: string; title: string };
}

export interface PermanentDeleteResponse {
  message: string;
}

export interface BulkTrashFailure {
  id: string;
  message: string;
}

export interface BulkTrashActionResponse {
  restoredCount?: number;
  deletedCount?: number;
  failedCount: number;
  failures?: BulkTrashFailure[];
}
