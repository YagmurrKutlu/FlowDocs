export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
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

export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return 'İzleyici';
  const r = role.toUpperCase();
  if (r === 'OWNER') return 'Sahip';
  if (r === 'ADMIN') return 'Admin';
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
