import { Skeleton } from '@mantine/core';
import type { TeamWorkspaceSummary } from '../types/team.types';
import { formatTeamDate } from '../team.utils';
import { RoleBadge } from './RoleBadge';
import styles from '../pages/TeamPage.module.css';

const ACCENTS = [
  styles.accentBlue,
  styles.accentGreen,
  styles.accentOrange,
  styles.accentViolet,
] as const;

const ICONS = ['🏢', '📁', '🗂️', '✨'];

type WorkspaceSwitcherProps = {
  workspaces: TeamWorkspaceSummary[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
};

export function WorkspaceSwitcher({
  workspaces,
  selectedId,
  loading,
  onSelect,
}: WorkspaceSwitcherProps) {
  if (loading) {
    return (
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Çalışma Alanları</h2>
        </div>
        <div className={styles.cardBody}>
          <Skeleton height={120} radius={14} />
        </div>
      </section>
    );
  }

  if (workspaces.length === 0) {
    return (
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Çalışma Alanları</h2>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden>
              🏢
            </span>
            Henüz bir çalışma alanına dahil değilsiniz.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Çalışma Alanları</h2>
        <p className={styles.cardSubtitle}>Aktif çalışma alanını seçin</p>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.workspaceGrid}>
          {workspaces.map((ws, index) => {
            const isActive = ws.id === selectedId;
            const accent = isActive
              ? styles.accentBlue
              : ACCENTS[index % ACCENTS.length];

            return (
              <button
                key={ws.id}
                type="button"
                className={`${styles.workspaceCard} ${
                  isActive ? styles.workspaceCardActive : ''
                }`}
                onClick={() => onSelect(ws.id)}
              >
                <div className={`${styles.workspaceAccent} ${accent}`} />
                <div className={styles.workspaceBody}>
                  <div className={styles.workspaceIcon} aria-hidden>
                    {ICONS[index % ICONS.length]}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <RoleBadge role={ws.role} />
                  </div>
                  <p className={styles.workspaceName}>{ws.name}</p>
                  <p className={styles.workspaceMeta}>
                    {ws.memberCount} üye · {ws.documentCount} doküman
                  </p>
                  <p className={styles.workspaceFooter}>
                    Güncellendi: {formatTeamDate(ws.updatedAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
