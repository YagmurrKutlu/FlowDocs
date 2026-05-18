import { Skeleton } from '@mantine/core';
import type { TrashSummaryResponse } from '../types/trash.types';
import styles from '../pages/TrashPage.module.css';

type TrashSummaryGridProps = {
  loading: boolean;
  summary: TrashSummaryResponse | undefined;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      dateStyle: 'medium',
    });
  } catch {
    return '—';
  }
}

export function TrashSummaryGrid({ loading, summary }: TrashSummaryGridProps) {
  if (loading) {
    return (
      <section className={styles.statsGrid} aria-label="Çöp kutusu özeti">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={118} radius={20} />
        ))}
      </section>
    );
  }

  return (
    <section className={styles.statsGrid} aria-label="Çöp kutusu özeti">
      <div className={styles.statCard}>
        <p className={styles.statValue}>{summary?.deletedDocumentCount ?? 0}</p>
        <p className={styles.statLabel}>Silinen Doküman</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueGreen}`}>
          {summary?.restorableCount ?? 0}
        </p>
        <p className={styles.statLabel}>Geri Yüklenebilir</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueMuted}`}>
          {formatDate(summary?.oldestDeletedAt ?? null)}
        </p>
        <p className={styles.statLabel}>En Eski Silinme</p>
      </div>
      <div className={`${styles.statCard} ${styles.statCardDanger}`}>
        <p className={`${styles.statValue} ${styles.statValueDanger}`}>
          {summary?.retentionPolicyDays ?? 30} gün
        </p>
        <p className={styles.statLabel}>30 gün politika</p>
      </div>
    </section>
  );
}
