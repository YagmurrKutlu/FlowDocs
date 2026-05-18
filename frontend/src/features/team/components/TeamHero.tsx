import { Button, Group } from '@mantine/core';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import heroStyles from '../../../shared/styles/premium-hero.module.css';
import styles from '../pages/TeamPage.module.css';

type TeamHeroProps = {
  canInvite: boolean;
  onInvite: () => void;
  onNewWorkspace: () => void;
};

export function TeamHero({ canInvite, onInvite, onNewWorkspace }: TeamHeroProps) {
  return (
    <section className={heroStyles.premiumHero}>
      <div className={heroStyles.premiumHeroContent}>
        <h1 className={heroStyles.premiumHeroTitle}>Ekibim</h1>
        <p className={heroStyles.premiumHeroDescription}>
          Çalışma alanlarınızı, ekip üyelerinizi ve işbirliği rollerinizi yönetin.
        </p>
        <p className={heroStyles.premiumHeroInfoNote}>
          Çalışma alanı sahipleri üyeleri davet edebilir, rolleri yönetebilir ve
          doküman erişimlerini düzenleyebilir.
        </p>
      </div>
      <Group className={heroStyles.premiumHeroActions} gap={12}>
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
