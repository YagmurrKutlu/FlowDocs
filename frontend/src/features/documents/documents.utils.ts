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

export function workspaceDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Kişisel';
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

export function formatMemberCount(count: number | null | undefined): string {
  if (count == null || count <= 0) {
    return '—';
  }
  return count === 1 ? '1 üye' : `${count} üye`;
}

export function formatRoleLabel(role: string): string {
  const r = role.toUpperCase();
  if (r === 'OWNER') return 'Sahip';
  if (r === 'EDITOR') return 'Editör';
  if (r === 'VIEWER') return 'İzleyici';
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
