import { Skeleton } from '@mantine/core';
import type { SharedSummaryResponse } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

type SharedSummaryGridProps = {
  loading: boolean;
  summary: SharedSummaryResponse | undefined;
};

export function SharedSummaryGrid({ loading, summary }: SharedSummaryGridProps) {
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
    <section className={styles.statsGrid} aria-label="Paylaşılanlar özeti">
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueBlue}`}>
          {summary?.withMeCount ?? 0}
        </p>
        <p className={styles.statLabel}>Benimle Paylaşılan</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueViolet}`}>
          {summary?.byMeCount ?? 0}
        </p>
        <p className={styles.statLabel}>Benim Paylaştıklarım</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueGreen}`}>
          {summary?.editorAccessCount ?? 0}
        </p>
        <p className={styles.statLabel}>Editor Yetkisi</p>
      </div>
      <div className={styles.statCard}>
        <p className={`${styles.statValue} ${styles.statValueMuted}`}>
          {summary?.viewerAccessCount ?? 0}
        </p>
        <p className={styles.statLabel}>Viewer Yetkisi</p>
      </div>
    </section>
  );
}
