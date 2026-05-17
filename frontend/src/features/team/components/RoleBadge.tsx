import type { WorkspaceRole } from '../types/team.types';
import styles from '../pages/TeamPage.module.css';

export function RoleBadge({ role }: { role: WorkspaceRole | string }) {
  const r = role.toUpperCase();
  let className = styles.badgeViewer;
  if (r === 'OWNER') className = styles.badgeOwner;
  else if (r === 'ADMIN') className = styles.badgeAdmin;
  else if (r === 'EDITOR') className = styles.badgeEditor;
  else if (r === 'PENDING') className = styles.badgePending;

  const label =
    r === 'OWNER'
      ? 'Sahip'
      : r === 'ADMIN'
        ? 'Yönetici'
        : r === 'EDITOR'
          ? 'Editör'
          : r === 'VIEWER'
            ? 'İzleyici'
            : r === 'PENDING'
              ? 'Bekliyor'
              : role;

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}
