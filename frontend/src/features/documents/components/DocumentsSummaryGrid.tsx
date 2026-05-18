import { Skeleton } from '@mantine/core';
import type { DocumentsSummaryResponse } from '../types/document.types';
import accentStyles from '../../../shared/styles/stat-card-accents.module.css';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsSummaryGridProps = {
  loading: boolean;
  summary: DocumentsSummaryResponse | undefined;
};

export function DocumentsSummaryGrid({
  loading,
  summary,
}: DocumentsSummaryGridProps) {
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
    <section className={styles.statsGrid} aria-label="Doküman özeti">
      <div className={`${accentStyles.statCard} ${accentStyles.statCardBlue}`}>
        <p className={`${accentStyles.statValue} ${accentStyles.statValueBlue}`}>
          {summary?.totalDocuments ?? 0}
        </p>
        <p className={accentStyles.statLabel}>Toplam Doküman</p>
      </div>
      <div className={`${accentStyles.statCard} ${accentStyles.statCardPurple}`}>
        <p className={`${accentStyles.statValue} ${accentStyles.statValuePurple}`}>
          {summary?.ownedDocuments ?? 0}
        </p>
        <p className={accentStyles.statLabel}>Sahip Olduklarım</p>
      </div>
      <div className={`${accentStyles.statCard} ${accentStyles.statCardEmerald}`}>
        <p className={`${accentStyles.statValue} ${accentStyles.statValueEmerald}`}>
          {summary?.sharedDocuments ?? 0}
        </p>
        <p className={accentStyles.statLabel}>Benimle Paylaşılan</p>
      </div>
      <div className={`${accentStyles.statCard} ${accentStyles.statCardAmber}`}>
        <p className={`${accentStyles.statValue} ${accentStyles.statValueAmber}`}>
          {summary?.favoriteDocuments ?? 0}
        </p>
        <p className={accentStyles.statLabel}>Favoriler</p>
      </div>
    </section>
  );
}
