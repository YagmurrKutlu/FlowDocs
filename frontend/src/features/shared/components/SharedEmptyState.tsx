import { Button } from '@mantine/core';
import { IconSearch, IconUsers } from '@tabler/icons-react';
import type { SharedTab } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

type SharedEmptyStateProps = {
  tab: SharedTab;
  variant: 'empty' | 'no-results';
  onClearFilters: () => void;
};

export function SharedEmptyState({ tab, variant, onClearFilters }: SharedEmptyStateProps) {
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

  const isWithMe = tab === 'with-me';

  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyIconWrap}>
        <IconUsers size={32} stroke={1.5} />
      </div>
      <h2 className={styles.emptyTitle}>
        {isWithMe
          ? 'Henüz sizinle paylaşılan doküman yok'
          : 'Henüz paylaştığınız doküman yok'}
      </h2>
      <p className={styles.emptyDescription}>
        {isWithMe
          ? 'Size erişim verilen dokümanlar burada görünecek.'
          : 'Dokümanlarınızı ekip arkadaşlarınızla paylaşarak burada takip edebilirsiniz.'}
      </p>
    </section>
  );
}
