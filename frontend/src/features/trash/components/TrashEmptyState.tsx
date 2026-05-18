import { Button } from '@mantine/core';
import { IconSearchOff, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/TrashPage.module.css';

type TrashEmptyStateProps = {
  variant?: 'empty' | 'no-results';
  onClearFilters?: () => void;
};

export function TrashEmptyState({
  variant = 'empty',
  onClearFilters,
}: TrashEmptyStateProps) {
  const isNoResults = variant === 'no-results';

  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyIconWrap} aria-hidden>
        {isNoResults ? (
          <IconSearchOff size={32} stroke={1.5} />
        ) : (
          <IconTrash size={32} stroke={1.5} />
        )}
      </div>
      <h2 className={styles.emptyTitle}>
        {isNoResults ? 'Sonuç bulunamadı' : 'Çöp kutusu boş'}
      </h2>
      <p className={styles.emptyDescription}>
        {isNoResults
          ? 'Arama veya filtre kriterlerinize uygun silinmiş doküman yok. Filtreleri temizleyerek tüm listeyi görebilirsiniz.'
          : 'Sildiğiniz dokümanlar burada listelenir. Geri yükleyebilir veya kalıcı olarak silebilirsiniz.'}
      </p>
      <div className={styles.emptyActions}>
        {isNoResults && onClearFilters ? (
          <Button variant="light" color="violet" onClick={onClearFilters}>
            Filtreleri temizle
          </Button>
        ) : null}
        <Button component={Link} to="/documents" variant="light" color="violet">
          Dokümanlara Git
        </Button>
      </div>
    </section>
  );
}
