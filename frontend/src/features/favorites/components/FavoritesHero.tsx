import { Button, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/FavoritesPage.module.css';

type FavoritesHeroProps = {
  onNewDocument: () => void;
};

export function FavoritesHero({ onNewDocument }: FavoritesHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <h1 className={styles.heroTitle}>Favoriler</h1>
        <p className={styles.heroDescription}>
          Önemli dokümanlarınıza hızlı erişin ve çalışma akışınızı organize edin.
        </p>
        <p className={styles.heroNote}>
          Favoriler yalnızca size özeldir ve çalışma alanı üyeleri tarafından görülmez.
        </p>
      </div>
      <Group className={styles.heroActions}>
        <Button className={styles.heroBtnSecondary} component={Link} to="/documents">
          Dokümanlara Git
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
