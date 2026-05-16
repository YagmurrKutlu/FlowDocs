import { apiClient } from '../../../shared/api/client';
import type {
  AddDocumentMemberPayload,
  AddDocumentMemberResponse,
  ApplyDocumentUpdatePayload,
  ApplyDocumentUpdateResponse,
  ConfirmDocumentMediaPayload,
  ConfirmDocumentMediaResponse,
  CreateDocumentCommentPayload,
  CreateDocumentCommentResponse,
  CreateDocumentPayload,
  CreateDocumentResponse,
  PresignDocumentMediaPayload,
  PresignDocumentMediaResponse,
  DeleteDocumentCommentResponse,
  DocumentCommentsResponse,
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentMembersResponse,
  DocumentStateResponse,
  ResolveDocumentCommentResponse,
  DeleteDocumentMemberResponse,
  UpdateDocumentMemberPayload,
  UpdateDocumentMemberResponse,
  UpdateDocumentCommentPayload,
  UpdateDocumentCommentResponse,
} from '../types/document.types';

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const { data } = await apiClient.get<DocumentListResponse>('/documents');
  return data;
}

export async function createDocumentMediaPresign(
  documentId: string,
  payload: PresignDocumentMediaPayload,
): Promise<PresignDocumentMediaResponse> {
  const { data } = await apiClient.post<PresignDocumentMediaResponse>(
    `/documents/${documentId}/media/presign`,
    payload,
  );
  return data;
}

export async function confirmDocumentMediaUpload(
  documentId: string,
  payload: ConfirmDocumentMediaPayload,
): Promise<ConfirmDocumentMediaResponse> {
  const { data } = await apiClient.post<ConfirmDocumentMediaResponse>(
    `/documents/${documentId}/media/confirm`,
    payload,
  );
  return data;
}

export async function fetchDocumentById(
  id: string,
): Promise<DocumentDetailResponse> {
  const { data } = await apiClient.get<DocumentDetailResponse>(
    `/documents/${id}`,
  );
  return data;
}

export async function createDocument(
  payload: CreateDocumentPayload,
): Promise<CreateDocumentResponse> {
  const { data } = await apiClient.post<CreateDocumentResponse>(
    '/documents',
    payload,
  );
  return data;
}

export async function fetchDocumentState(
  documentId: string,
): Promise<DocumentStateResponse> {
  const { data } = await apiClient.get<DocumentStateResponse>(
    `/documents/${documentId}/state`,
  );
  return data;
}

function devPersistDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only document persist tracing
    console.log('[persist-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only document persist tracing
    console.log('[persist-debug]', message);
  }
}

export async function postDocumentUpdate(
  documentId: string,
  payload: ApplyDocumentUpdatePayload,
): Promise<ApplyDocumentUpdateResponse> {
  try {
    const { data } = await apiClient.post<ApplyDocumentUpdateResponse>(
      `/documents/${documentId}/updates`,
      payload,
    );
    return data;
  } catch (error) {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: unknown } };
      message?: string;
    };
    const status = axiosError.response?.status;
    const responseMessage = axiosError.response?.data?.message;
    devPersistDebugLog('document update failed', {
      documentId,
      status,
      message:
        typeof responseMessage === 'string'
          ? responseMessage
          : Array.isArray(responseMessage)
            ? responseMessage.join(', ')
            : axiosError.message ?? 'unknown',
      updateBase64Length:
        typeof payload.updateBase64 === 'string' ? payload.updateBase64.length : 0,
      hasEditorStateJson: typeof payload.editorStateJson === 'string',
      editorStateJsonLength:
        typeof payload.editorStateJson === 'string'
          ? payload.editorStateJson.length
          : 0,
    });
    throw error;
  }
}

export async function fetchDocumentMembers(
  documentId: string,
): Promise<DocumentMembersResponse> {
  const { data } = await apiClient.get<DocumentMembersResponse>(
    `/documents/${documentId}/members`,
  );
  return data;
}

export async function addDocumentMember(
  documentId: string,
  payload: AddDocumentMemberPayload,
): Promise<AddDocumentMemberResponse> {
  const { data } = await apiClient.post<AddDocumentMemberResponse>(
    `/documents/${documentId}/members`,
    payload,
  );
  return data;
}

export async function updateDocumentMemberRole(
  documentId: string,
  memberId: string,
  payload: UpdateDocumentMemberPayload,
): Promise<UpdateDocumentMemberResponse> {
  const { data } = await apiClient.patch<UpdateDocumentMemberResponse>(
    `/documents/${documentId}/members/${memberId}`,
    payload,
  );
  return data;
}

export async function removeDocumentMember(
  documentId: string,
  memberId: string,
): Promise<DeleteDocumentMemberResponse> {
  const { data } = await apiClient.delete<DeleteDocumentMemberResponse>(
    `/documents/${documentId}/members/${memberId}`,
  );
  return data;
}

export async function fetchDocumentComments(
  documentId: string,
): Promise<DocumentCommentsResponse> {
  const { data } = await apiClient.get<DocumentCommentsResponse>(
    `/documents/${documentId}/comments`,
  );
  return data;
}

export async function createDocumentComment(
  documentId: string,
  payload: CreateDocumentCommentPayload,
): Promise<CreateDocumentCommentResponse> {
  const { data } = await apiClient.post<CreateDocumentCommentResponse>(
    `/documents/${documentId}/comments`,
    payload,
  );
  return data;
}

export async function resolveDocumentComment(
  documentId: string,
  commentId: string,
): Promise<ResolveDocumentCommentResponse> {
  const { data } = await apiClient.post<ResolveDocumentCommentResponse>(
    `/documents/${documentId}/comments/${commentId}/resolve`,
    {},
  );
  return data;
}

export async function updateDocumentComment(
  documentId: string,
  commentId: string,
  payload: UpdateDocumentCommentPayload,
): Promise<UpdateDocumentCommentResponse> {
  const { data } = await apiClient.patch<UpdateDocumentCommentResponse>(
    `/documents/${documentId}/comments/${commentId}`,
    payload,
  );
  return data;
}

export async function deleteDocumentComment(
  documentId: string,
  commentId: string,
): Promise<DeleteDocumentCommentResponse> {
  const { data } = await apiClient.delete<DeleteDocumentCommentResponse>(
    `/documents/${documentId}/comments/${commentId}`,
  );
  return data;
}
