import axios from 'axios';
import { apiClient } from '../../shared/api/client';
import { getApiErrorMessage } from '../../shared/api/errors';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return '—';
  }

  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function displayPersonName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Bilinmiyor';
}

export function sharedUserCountLabel(count: number): string {
  return count === 1 ? '1 kişiyle paylaşıldı' : `${count} kişiyle paylaşıldı`;
}

export async function probeDocumentAccess(
  documentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await apiClient.get(`/documents/${documentId}`);
    return { ok: true };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 410) {
        return { ok: false, message: 'Bu doküman çöp kutusunda.' };
      }
      if (status === 403 || status === 404) {
        return { ok: false, message: 'Bu dokümana erişiminiz artık yok.' };
      }
    }
    return { ok: false, message: getApiErrorMessage(error) };
  }
}
export function previewSnippet(previewContent: unknown): string {
  if (previewContent == null) {
    return 'Önizleme bulunmuyor.';
  }

  if (typeof previewContent === 'string') {
    const trimmed = previewContent.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 140) : 'Önizleme bulunmuyor.';
  }

  if (typeof previewContent === 'object') {
    const text = JSON.stringify(previewContent);
    return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  }

  return 'Önizleme bulunmuyor.';
}

export function workspaceDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Kişisel';
}

export function ownerInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

export function formatRoleLabel(role: string): string {
  const r = role.toUpperCase();
  if (r === 'OWNER') return 'Sahip';
  if (r === 'EDITOR') return 'Editör';
  if (r === 'VIEWER') return 'İzleyici';
  if (r === 'COMMENTER') return 'Yorumcu';
  return role;
}

export async function copyDocumentLink(documentId: string): Promise<boolean> {
  const url = `${window.location.origin}/documents/${documentId}`;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
