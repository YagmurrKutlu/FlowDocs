import { Skeleton } from '@mantine/core';
import styles from '../pages/TeamPage.module.css';

type TeamStatsGridProps = {
  loading: boolean;
  totalWorkspaces: number;
  totalMembers: number;
  totalDocuments: number;
  activeCollaborators: number | null;
};

const STATS = [
  { key: 'workspaces', label: 'Çalışma Alanı', accent: styles.statBlue },
  { key: 'members', label: 'Toplam Üye', accent: styles.statGreen },
  { key: 'documents', label: 'Doküman', accent: styles.statOrange },
  { key: 'collab', label: 'Aktif İşbirlikçi', accent: styles.statMuted },
] as const;

export function TeamStatsGrid({
  loading,
  totalWorkspaces,
  totalMembers,
  totalDocuments,
  activeCollaborators,
}: TeamStatsGridProps) {
  const values: Record<(typeof STATS)[number]['key'], string> = {
    workspaces: String(totalWorkspaces),
    members: String(totalMembers),
    documents: String(totalDocuments),
    collab: activeCollaborators == null ? '—' : String(activeCollaborators),
  };

  if (loading) {
    return (
      <section className={styles.statsGrid} aria-label="Ekip istatistikleri">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={118} radius={14} />
        ))}
      </section>
    );
  }

  return (
    <section className={styles.statsGrid} aria-label="Ekip istatistikleri">
      {STATS.map((stat) => (
        <div key={stat.key} className={styles.statCard}>
          <p className={`${styles.statValue} ${stat.accent}`}>
            {values[stat.key]}
          </p>
          <p className={styles.statLabel}>{stat.label}</p>
        </div>
      ))}
    </section>
  );
}
