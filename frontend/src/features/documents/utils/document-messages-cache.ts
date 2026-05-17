import type { QueryClient } from '@tanstack/react-query';
import { documentsQueryKeys } from '../hooks/useDocumentsQueries';
import type { DocumentMessage, DocumentMessagesResponse } from '../types/document.types';

export const DOCUMENT_MESSAGE_MAX_LENGTH = 2000;

export function normalizeDocumentMessage(
  message: DocumentMessage,
  currentUserId: string | undefined,
): DocumentMessage {
  return {
    ...message,
    createdAt:
      typeof message.createdAt === 'string'
        ? message.createdAt
        : new Date(message.createdAt).toISOString(),
    isMine: message.author.id === currentUserId,
  };
}

export function upsertDocumentMessageInCache(
  queryClient: QueryClient,
  documentId: string,
  incoming: DocumentMessage,
  currentUserId: string | undefined,
): void {
  const normalized = normalizeDocumentMessage(incoming, currentUserId);
  queryClient.setQueryData<DocumentMessagesResponse>(
    documentsQueryKeys.messages(documentId),
    (current) => {
      const existing = current?.messages ?? [];
      if (existing.some((item) => item.id === normalized.id)) {
        return current;
      }
      return {
        messages: [...existing, normalized].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      };
    },
  );
}

export function removeDocumentMessageFromCache(
  queryClient: QueryClient,
  documentId: string,
  messageId: string,
): void {
  queryClient.setQueryData<DocumentMessagesResponse>(
    documentsQueryKeys.messages(documentId),
    (current) => {
      if (!current) return current;
      return {
        messages: current.messages.filter((item) => item.id !== messageId),
      };
    },
  );
}
