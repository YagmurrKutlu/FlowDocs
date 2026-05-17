import { Skeleton } from '@mantine/core';
import type { TeamWorkspaceSummary } from '../types/team.types';
import { formatTeamDateTime } from '../team.utils';
import styles from '../pages/TeamPage.module.css';

type TeamHealthCardProps = {
  workspace: TeamWorkspaceSummary | null;
  pendingInviteCount: number;
  loading: boolean;
};

export function TeamHealthCard({
  workspace,
  pendingInviteCount,
  loading,
}: TeamHealthCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Çalışma Alanı Özeti</h2>
        <p className={styles.cardSubtitle}>Seçili alanın durumu</p>
      </div>

      <div className={styles.cardBody}>
      {loading || !workspace ? (
        <Skeleton height={120} radius={14} />
      ) : (
        <>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Alan</span>
            <span className={styles.healthValue}>{workspace.name}</span>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Üye sayısı</span>
            <span className={styles.healthValue}>{workspace.memberCount}</span>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Doküman sayısı</span>
            <span className={styles.healthValue}>{workspace.documentCount}</span>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Bekleyen davet</span>
            <span className={styles.healthValue}>{pendingInviteCount}</span>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Aktif işbirlikçi</span>
            <span className={styles.healthValue}>—</span>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthLabel}>Son güncelleme</span>
            <span className={styles.healthValue}>
              {formatTeamDateTime(workspace.updatedAt)}
            </span>
          </div>
        </>
      )}
      </div>
    </section>
  );
}
