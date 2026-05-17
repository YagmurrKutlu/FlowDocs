import { Button, Skeleton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import type { TeamDocument } from '../types/team.types';
import { formatTeamDateTime } from '../team.utils';
import styles from '../pages/TeamPage.module.css';

type TeamDocumentsCardProps = {
  documents: TeamDocument[];
  loading: boolean;
};

export function TeamDocumentsCard({ documents, loading }: TeamDocumentsCardProps) {
  const navigate = useNavigate();

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Çalışma Alanı Dokümanları</h2>
        <p className={styles.cardSubtitle}>Bu alandaki paylaşılan dokümanlar</p>
      </div>

      <div className={styles.cardBody}>
      {loading ? (
        <Skeleton height={120} radius={14} />
      ) : documents.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden>
            📄
          </span>
          Bu çalışma alanında henüz doküman yok.
        </div>
      ) : (
        <div>
          {documents.map((doc) => (
            <div key={doc.id} className={styles.docRow}>
              <div>
                <p className={styles.activityTitle}>{doc.title}</p>
                <p className={styles.activityMeta}>
                  {doc.memberCount} üye · Güncellendi{' '}
                  {formatTeamDateTime(doc.updatedAt)}
                </p>
              </div>
              <Button
                size="xs"
                variant="light"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                Aç
              </Button>
            </div>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
