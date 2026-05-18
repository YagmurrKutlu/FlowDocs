import { Button, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import styles from '../pages/SharedPage.module.css';

type SharedHeroProps = {
  onNewDocument: () => void;
};

export function SharedHero({ onNewDocument }: SharedHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <h1 className={styles.heroTitle}>Paylaşılanlar</h1>
        <p className={styles.heroDescription}>
          Size paylaşılan ve sizin paylaştığınız dokümanları tek yerden yönetin.
        </p>
        <p className={styles.heroNote}>
          Paylaşım erişimleri rol bazlıdır ve doküman yetkilerinize göre gösterilir.
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
