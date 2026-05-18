export interface DocumentListItem {
  id: string;
  title: string;
  slug: string;
  workspaceId: string;
  updatedAt: string;
  currentVersion: number;
  isFavorite?: boolean;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
}

export interface DocumentMemberUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface DocumentMemberDetail {
  id: string;
  userId: string;
  role: DocumentShareRole;
  createdAt: string;
  user: DocumentMemberUser;
}

export type DocumentShareRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type CurrentUserRole =
  | DocumentShareRole
  | 'ADMIN'
  | null;

export interface DocumentPermissions {
  canRead: boolean;
  canEdit: boolean;
  canShare: boolean;
}

export interface DocumentDetail {
  id: string;
  title: string;
  slug: string;
  workspaceId: string;
  previewContent: unknown;
  currentVersion: number;
  createdById: string;
  lastEditedById: string | null;
  createdAt: string;
  updatedAt: string;
  members: DocumentMemberDetail[];
  currentUserRole: CurrentUserRole;
  permissions: DocumentPermissions;
}

export interface DocumentDetailResponse {
  document: DocumentDetail;
}

export interface CreateDocumentPayload {
  workspaceId: string;
  title: string;
}

export interface CreateDocumentResponse {
  document: {
    id: string;
    title: string;
    slug: string;
    workspaceId: string;
    createdById: string;
    lastEditedById: string | null;
    currentVersion: number;
    previewContent: unknown;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DocumentStateResponse {
  currentVersion: number;
  editorStateJson?: string | null;
  previewContent?: string | null;
  snapshotVersion: number | null;
  totalUpdates: number;
  updatesAfterSnapshot: number;
  stateUpdateBase64: string;
  snapshotInterval: number;
}

export interface ApplyDocumentUpdatePayload {
  updateBase64: string;
  sourceClientId?: string;
  editorStateJson?: string;
}

export interface ApplyDocumentUpdateResponse {
  version: number;
}

export interface DocumentMemberRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: DocumentShareRole;
  createdAt: string;
}

export interface DocumentMembersResponse {
  members: DocumentMemberRow[];
}

export interface AddDocumentMemberPayload {
  email: string;
  role: Exclude<DocumentShareRole, 'OWNER'>;
}

export interface AddDocumentMemberResponse {
  member: DocumentMemberRow;
}

export interface UpdateDocumentMemberPayload {
  role: Exclude<DocumentShareRole, 'OWNER'>;
}

export interface UpdateDocumentMemberResponse {
  member: DocumentMemberRow;
}

export interface DeleteDocumentMemberResponse {
  deleted: boolean;
}

export interface PresignDocumentMediaPayload {
  fileName: string;
  contentType: string;
  size: number;
}

export interface PresignDocumentMediaResponse {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface ConfirmDocumentMediaPayload {
  objectKey: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface ConfirmDocumentMediaResponse {
  media: {
    id: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: string;
    /** Browser-reachable URL (typically same-origin API file route). */
    url: string;
    publicUrl?: string;
    downloadUrl?: string;
    objectUrl?: string;
  };
}

export interface DocumentCommentAuthor {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  body: string;
  selectedText: string | null;
  anchorOffset: number | null;
  focusOffset: number | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: DocumentCommentAuthor;
  resolvedBy: DocumentCommentAuthor | null;
}

export interface DocumentCommentsResponse {
  comments: DocumentComment[];
}

export interface CreateDocumentCommentPayload {
  body: string;
  selectedText?: string;
  anchorOffset?: number;
  focusOffset?: number;
}

export interface CreateDocumentCommentResponse {
  comment: DocumentComment;
}

export interface UpdateDocumentCommentPayload {
  body: string;
}

export interface UpdateDocumentCommentResponse {
  comment: DocumentComment;
}

export interface ResolveDocumentCommentResponse {
  comment: DocumentComment;
}

export interface DeleteDocumentCommentResponse {
  deleted: boolean;
}

export interface DocumentMessageAuthor {
  id: string;
  name: string;
  email: string;
}

export interface DocumentMessage {
  id: string;
  documentId: string;
  body: string;
  createdAt: string;
  author: DocumentMessageAuthor;
  isMine: boolean;
}

export interface DocumentMessagesResponse {
  messages: DocumentMessage[];
}

export interface CreateDocumentMessageResponse {
  message: DocumentMessage;
}

export interface DeleteDocumentMessageResponse {
  deleted: true;
}
