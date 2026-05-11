import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDocumentMember,
  createDocument,
  createDocumentComment,
  deleteDocumentComment,
  fetchDocumentById,
  fetchDocumentComments,
  fetchDocumentMembers,
  fetchDocuments,
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
} from '../types/document.types';

export const documentsQueryKeys = {
  all: ['documents'] as const,
  list: () => [...documentsQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...documentsQueryKeys.all, 'detail', id] as const,
  members: (id: string) => [...documentsQueryKeys.all, 'members', id] as const,
  comments: (id: string) => [...documentsQueryKeys.all, 'comments', id] as const,
};

export function useDocumentsListQuery() {
  return useQuery({
    queryKey: documentsQueryKeys.list(),
    queryFn: fetchDocuments,
  });
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
      void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
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
      void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
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
      void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
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
