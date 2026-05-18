import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDocumentMember,
  createDocument,
  createDocumentComment,
  createDocumentMessage,
  bulkMoveDocumentsToTrash,
  deleteDocument,
  deleteDocumentComment,
  deleteDocumentMessage,
  fetchDocumentById,
  fetchDocumentComments,
  fetchDocumentMessages,
  fetchDocumentMembers,
  fetchDocuments,
  fetchDocumentsSummary,
  updateDocument,
  removeDocumentMember,
  resolveDocumentComment,
  updateDocumentMemberRole,
  updateDocumentComment,
} from '../api/documents.api';
import type {
  AddDocumentMemberPayload,
  CreateDocumentCommentPayload,
  CreateDocumentPayload,
  DocumentCommentsResponse,
  UpdateDocumentMemberPayload,
  UpdateDocumentCommentPayload,
  DocumentsListParams,
} from '../types/document.types';
import {
  normalizeDocumentMessage,
  removeDocumentMessageFromCache,
  upsertDocumentMessageInCache,
} from '../utils/document-messages-cache';

export const documentsQueryKeys = {
  all: ['documents'] as const,
  summary: () => [...documentsQueryKeys.all, 'summary'] as const,
  list: (filters?: DocumentsListParams) =>
    filters
      ? ([...documentsQueryKeys.all, 'list', filters] as const)
      : ([...documentsQueryKeys.all, 'list'] as const),
  detail: (id: string) => [...documentsQueryKeys.all, 'detail', id] as const,
  members: (id: string) => [...documentsQueryKeys.all, 'members', id] as const,
  comments: (id: string) => [...documentsQueryKeys.all, 'comments', id] as const,
  messages: (id: string) => ['document-messages', id] as const,
};

export function useDocumentsSummaryQuery() {
  return useQuery({
    queryKey: documentsQueryKeys.summary(),
    queryFn: fetchDocumentsSummary,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDocumentsListQuery(filters?: DocumentsListParams) {
  return useQuery({
    queryKey: documentsQueryKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
  });
}

export function invalidateDocumentsRelated(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.summary() });
  void queryClient.invalidateQueries({ queryKey: ['documents', 'list'] });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['shared'] });
  void queryClient.invalidateQueries({ queryKey: ['favorites'] });
}

export function useDocumentDetailQuery(documentId: string | undefined) {
  return useQuery({
    queryKey: documentsQueryKeys.detail(documentId ?? ''),
    queryFn: () => fetchDocumentById(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDocumentPayload) => createDocument(payload),
    onSuccess: () => {
      invalidateDocumentsRelated(queryClient);
    },
  });
}

export function useRenameDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      title,
    }: {
      documentId: string;
      title: string;
    }) => updateDocument(documentId, { title }),
    onSuccess: (_data, variables) => {
      invalidateDocumentsRelated(queryClient);
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.detail(variables.documentId),
      });
    },
  });
}

export function useBulkMoveToTrashMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) => bulkMoveDocumentsToTrash(documentIds),
    onSuccess: () => {
      invalidateDocumentsRelated(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      invalidateDocumentsRelated(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDocumentMembersQuery(documentId: string | undefined) {
  return useQuery({
    queryKey: documentsQueryKeys.members(documentId ?? ''),
    queryFn: () => fetchDocumentMembers(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useAddDocumentMemberMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddDocumentMemberPayload) =>
      addDocumentMember(documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.members(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.detail(documentId),
      });
      invalidateDocumentsRelated(queryClient);
    },
  });
}

export function useUpdateDocumentMemberRoleMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: string;
      payload: UpdateDocumentMemberPayload;
    }) => updateDocumentMemberRole(documentId, memberId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.members(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.detail(documentId),
      });
    },
  });
}

export function useRemoveDocumentMemberMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeDocumentMember(documentId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.members(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.detail(documentId),
      });
      invalidateDocumentsRelated(queryClient);
    },
  });
}

export function useDocumentCommentsQuery(documentId: string | undefined) {
  return useQuery({
    queryKey: documentsQueryKeys.comments(documentId ?? ''),
    queryFn: () => fetchDocumentComments(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentCommentMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDocumentCommentPayload) =>
      createDocumentComment(documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.comments(documentId),
      });
    },
  });
}

export function useResolveDocumentCommentMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => resolveDocumentComment(documentId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.comments(documentId),
      });
    },
  });
}

export function useUpdateDocumentCommentMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: UpdateDocumentCommentPayload;
    }) => updateDocumentComment(documentId, commentId, payload),
    onSuccess: ({ comment }) => {
      queryClient.setQueryData<DocumentCommentsResponse>(
        documentsQueryKeys.comments(documentId),
        (current) => {
          if (!current) return current;
          return {
            comments: current.comments.map((existing) =>
              existing.id === comment.id ? comment : existing,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.comments(documentId),
      });
    },
  });
}

export function useDeleteDocumentCommentMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteDocumentComment(documentId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.comments(documentId),
      });
    },
  });
}

export function useDocumentMessagesQuery(documentId: string | undefined) {
  return useQuery({
    queryKey: documentsQueryKeys.messages(documentId ?? ''),
    queryFn: () => fetchDocumentMessages(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentMessageMutation(
  documentId: string,
  currentUserId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => createDocumentMessage(documentId, body),
    onSuccess: ({ message }) => {
      upsertDocumentMessageInCache(
        queryClient,
        documentId,
        normalizeDocumentMessage(message, currentUserId),
        currentUserId,
      );
    },
  });
}

export function useDeleteDocumentMessageMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => deleteDocumentMessage(documentId, messageId),
    onSuccess: (_result, messageId) => {
      removeDocumentMessageFromCache(queryClient, documentId, messageId);
    },
  });
}
