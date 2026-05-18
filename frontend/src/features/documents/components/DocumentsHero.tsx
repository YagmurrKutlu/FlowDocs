import { Button, Group } from '@mantine/core';
import { IconLayoutGridAdd, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsHeroProps = {
  onNewWorkspace: () => void;
  onNewDocument: () => void;
};

export function DocumentsHero({ onNewWorkspace, onNewDocument }: DocumentsHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <h1 className={styles.heroTitle}>Dokümanlarım</h1>
        <p className={styles.heroDescription}>
          Tüm aktif dokümanlarınızı, çalışma alanlarınızı ve paylaşım durumlarınızı yönetin.
        </p>
        <p className={styles.heroNote}>
          Çöp kutusuna taşınan dokümanlar bu listeden gizlenir.
        </p>
      </div>
      <Group className={styles.heroActions} wrap="wrap">
        <Button
          className={styles.heroBtnSecondary}
          component={Link}
          to="/trash"
          leftSection={<IconTrash size={16} />}
        >
          Çöp Kutusuna Git
        </Button>
        <Button
          className={styles.heroBtnWorkspace}
          leftSection={<IconLayoutGridAdd size={16} />}
          onClick={onNewWorkspace}
        >
          Yeni Çalışma Alanı
        </Button>
        <Button
          className={styles.heroBtnPrimary}
          leftSection={<IconPlus size={16} />}
          onClick={onNewDocument}
        >
          Yeni Doküman
        </Button>
      </Group>
    </section>
  );
}
