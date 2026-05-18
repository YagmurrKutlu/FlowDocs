import { Skeleton } from '@mantine/core';
import accentStyles from '../../../shared/styles/stat-card-accents.module.css';
import styles from '../pages/TeamPage.module.css';

type TeamStatsGridProps = {
  loading: boolean;
  totalWorkspaces: number;
  totalMembers: number;
  totalDocuments: number;
  activeCollaborators: number | null;
};

const STATS = [
  {
    key: 'workspaces' as const,
    label: 'Çalışma Alanı',
    cardClass: accentStyles.statCardBlue,
    valueClass: accentStyles.statValueBlue,
  },
  {
    key: 'members' as const,
    label: 'Toplam Üye',
    cardClass: accentStyles.statCardEmerald,
    valueClass: accentStyles.statValueEmerald,
  },
  {
    key: 'documents' as const,
    label: 'Doküman',
    cardClass: accentStyles.statCardOrange,
    valueClass: accentStyles.statValueOrange,
  },
  {
    key: 'collab' as const,
    label: 'Aktif İşbirlikçi',
    cardClass: accentStyles.statCardPurple,
    valueClass: accentStyles.statValuePurple,
  },
];

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
          <Skeleton key={i} height={118} radius={20} />
        ))}
      </section>
    );
  }

  return (
    <section className={styles.statsGrid} aria-label="Ekip istatistikleri">
      {STATS.map((stat) => (
        <div
          key={stat.key}
          className={`${accentStyles.statCard} ${stat.cardClass}`}
        >
          <p className={`${accentStyles.statValue} ${stat.valueClass}`}>
            {values[stat.key]}
          </p>
          <p className={accentStyles.statLabel}>{stat.label}</p>
        </div>
      ))}
    </section>
  );
}
