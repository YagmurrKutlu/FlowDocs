import { Skeleton } from '@mantine/core';
import type { FavoritesSummaryResponse } from '../types/favorites.types';
import styles from '../pages/FavoritesPage.module.css';

type FavoritesSummaryGridProps = {
  loading: boolean;
  summary: FavoritesSummaryResponse | undefined;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

export function FavoritesSummaryGrid({ loading, summary }: FavoritesSummaryGridProps) {
  if (loading) {
    return (
      <section className={styles.statsGrid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={118} radius={20} />
        ))}
      </section>
    );
  }

  return (
    <section className={styles.statsGrid} aria-label="Favoriler özeti">
      <div className={styles.statCard}>
        <p className={styles.statValue}>{summary?.favoriteCount ?? 0}</p>
        <p className={styles.statLabel}>Favori Doküman</p>
      </div>
      <div className={styles.statCard}>
        <p className={styles.statValue}>{summary?.workspaceCount ?? 0}</p>
        <p className={styles.statLabel}>Çalışma Alanı</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueMuted}`}>
          {formatDate(summary?.latestFavoritedAt ?? null)}
        </p>
        <p className={styles.statLabel}>Son Favori</p>
      </div>
      <div className={styles.statCard}>
        <p className={styles.statValue}>{summary?.recentlyUpdatedCount ?? 0}</p>
        <p className={styles.statLabel}>Son 7 Gün Güncellenen</p>
      </div>
    </section>
  );
}
