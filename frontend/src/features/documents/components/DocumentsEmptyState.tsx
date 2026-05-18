import { Anchor, Button } from '@mantine/core';
import { IconFileText, IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsEmptyStateProps = {
  variant: 'empty' | 'no-results';
  onNewDocument: () => void;
  onClearFilters: () => void;
};

export function DocumentsEmptyState({
  variant,
  onNewDocument,
  onClearFilters,
}: DocumentsEmptyStateProps) {
  if (variant === 'no-results') {
    return (
      <section className={styles.emptyState}>
        <div className={`${styles.emptyIconWrap} ${styles.emptyIconWrapMuted}`}>
          <IconSearch size={32} stroke={1.5} />
        </div>
        <h2 className={styles.emptyTitle}>Sonuç bulunamadı</h2>
        <p className={styles.emptyDescription}>
          Arama veya filtreleri değiştirerek tekrar deneyin.
        </p>
        <Button
          className={styles.emptyBtnSecondary}
          variant="light"
          color="violet"
          onClick={onClearFilters}
        >
          Filtreleri temizle
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyIconWrap}>
        <IconFileText size={32} stroke={1.5} />
      </div>
      <h2 className={styles.emptyTitle}>Henüz dokümanınız yok</h2>
      <p className={styles.emptyDescription}>
        İlk dokümanınızı oluşturarak FlowDocs çalışma alanınızı başlatın.
      </p>
      <Button className={styles.emptyBtnPrimary} onClick={onNewDocument}>
        Yeni Doküman Oluştur
      </Button>
      <Anchor className={styles.emptyTrashLink} component={Link} to="/trash" size="sm">
        Çöp Kutusuna Git
      </Anchor>
    </section>
  );
}
