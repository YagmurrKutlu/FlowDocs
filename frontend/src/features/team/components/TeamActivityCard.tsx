import { Skeleton } from '@mantine/core';
import type { TeamActivity } from '../types/team.types';
import { formatTeamDateTime } from '../team.utils';
import styles from '../pages/TeamPage.module.css';

type TeamActivityCardProps = {
  activities: TeamActivity[];
  loading: boolean;
};

export function TeamActivityCard({ activities, loading }: TeamActivityCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Ekip Aktivitesi</h2>
        <p className={styles.cardSubtitle}>Son işlemler ve olaylar</p>
      </div>

      <div className={styles.cardBody}>
      {loading ? (
        <Skeleton height={140} radius={14} />
      ) : activities.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden>
            📋
          </span>
          Henüz ekip aktivitesi bulunmuyor.
        </div>
      ) : (
        <div>
          {activities.map((item) => (
            <article key={item.id} className={styles.activityItem}>
              <p className={styles.activityTitle}>{item.title}</p>
              <p className={styles.activityMeta}>
                {item.description} · {item.actorName} ·{' '}
                {formatTeamDateTime(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
