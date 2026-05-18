import { Button, Group } from '@mantine/core';
import { IconPlus, IconSearch, IconStar } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/FavoritesPage.module.css';

type FavoritesEmptyStateProps = {
  variant: 'empty' | 'no-results';
  onClearFilters: () => void;
  onNewDocument?: () => void;
};

export function FavoritesEmptyState({
  variant,
  onClearFilters,
  onNewDocument,
}: FavoritesEmptyStateProps) {
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
        <Button className={styles.emptyBtnSecondary} variant="light" color="violet" onClick={onClearFilters}>
          Filtreleri temizle
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyIconWrap}>
        <IconStar size={32} stroke={1.5} />
      </div>
      <h2 className={styles.emptyTitle}>Henüz favori dokümanınız yok</h2>
      <p className={styles.emptyDescription}>
        Önemli dokümanları yıldızlayarak burada hızlı erişim sağlayabilirsiniz.
      </p>
      <Group gap="sm" justify="center">
        <Button className={styles.emptyBtnPrimary} component={Link} to="/documents">
          Dokümanlara Git
        </Button>
        {onNewDocument ? (
          <Button
            className={styles.emptyBtnSecondary}
            variant="light"
            color="yellow"
            leftSection={<IconPlus size={16} />}
            onClick={onNewDocument}
          >
            Yeni Doküman
          </Button>
        ) : null}
      </Group>
    </section>
  );
}
