import { Button, Group } from '@mantine/core';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import styles from '../pages/TeamPage.module.css';

type TeamHeroProps = {
  canInvite: boolean;
  onInvite: () => void;
  onNewWorkspace: () => void;
};

export function TeamHero({ canInvite, onInvite, onNewWorkspace }: TeamHeroProps) {
  return (
    <section className={styles.hero}>
      <div>
        <h1 className={styles.heroTitle}>Ekibim</h1>
        <p className={styles.heroDescription}>
          Çalışma alanlarınızı, ekip üyelerinizi ve işbirliği rollerinizi yönetin.
        </p>
      </div>
      <Group className={styles.heroActions} gap={14}>
        <Button
          className={styles.heroPrimaryBtn}
          leftSection={<IconUserPlus size={16} />}
          disabled={!canInvite}
          onClick={onInvite}
        >
          Üye Davet Et
        </Button>
        <Button
          className={styles.heroPrimaryBtn}
          leftSection={<IconPlus size={16} />}
          onClick={onNewWorkspace}
        >
          Yeni Çalışma Alanı
        </Button>
      </Group>
    </section>
  );
}
