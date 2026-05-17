import type { WorkspaceRole } from './types/team.types';

export function isWorkspaceOwner(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER';
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'OWNER':
      return 'Sahip';
    case 'ADMIN':
      return 'Yönetici';
    case 'EDITOR':
      return 'Editör';
    case 'VIEWER':
      return 'İzleyici';
    default:
      return role;
  }
}

export function formatTeamDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function inviteStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Bekliyor';
    case 'ACCEPTED':
      return 'Kabul edildi';
    case 'CANCELLED':
      return 'İptal edildi';
    default:
      return status;
  }
}

export function formatTeamDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
