import { Button, Group } from '@mantine/core';
import { IconArrowBackUp, IconTrash } from '@tabler/icons-react';
import styles from '../pages/TrashPage.module.css';

type TrashHeroProps = {
  selectedCount: number;
  bulkRestoreLoading: boolean;
  bulkDeleteLoading: boolean;
  onBulkRestore: () => void;
  onBulkPermanentDelete: () => void;
};

export function TrashHero({
  selectedCount,
  bulkRestoreLoading,
  bulkDeleteLoading,
  onBulkRestore,
  onBulkPermanentDelete,
}: TrashHeroProps) {
  const hasSelection = selectedCount > 0;

  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <h1 className={styles.heroTitle}>Çöp Kutusu</h1>
        <p className={styles.heroDescription}>
          Silinen dokümanları geri yükleyin veya kalıcı olarak silin.
        </p>
        <p className={styles.heroNote}>
          Dokümanlar çöp kutusundan geri yüklenebilir. Kalıcı silme işlemi geri
          alınamaz.
        </p>
      </div>
      <Group className={styles.heroActions}>
        <Button
          className={styles.restoreBtn}
          leftSection={<IconArrowBackUp size={16} />}
          disabled={!hasSelection}
          loading={bulkRestoreLoading}
          onClick={onBulkRestore}
        >
          Seçilenleri Geri Yükle
        </Button>
        <Button
          className={styles.dangerBtn}
          leftSection={<IconTrash size={16} />}
          disabled={!hasSelection}
          loading={bulkDeleteLoading}
          onClick={onBulkPermanentDelete}
        >
          Seçilenleri Kalıcı Sil
        </Button>
      </Group>
    </section>
  );
}
