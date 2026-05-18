import { Button, Group, TextInput } from '@mantine/core';
import { IconLayoutGridAdd, IconPlus, IconSearch } from '@tabler/icons-react';
import heroStyles from '../../../shared/styles/premium-hero.module.css';
import styles from '../pages/DashboardPage.module.css';

type DashboardHeroProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onNewWorkspace: () => void;
  onNewDocument: () => void;
};

export function DashboardHero({
  search,
  onSearchChange,
  onNewWorkspace,
  onNewDocument,
}: DashboardHeroProps) {
  return (
    <section className={heroStyles.premiumHero}>
      <div className={heroStyles.premiumHeroContent}>
        <h1 className={heroStyles.premiumHeroTitle}>Anasayfa</h1>
        <p className={heroStyles.premiumHeroDescription}>Tüm dokümanlarınız</p>
        <p className={heroStyles.premiumHeroInfoNote}>
          Aktif dokümanlarınızı, canlı işbirliği durumlarını ve son güncellemeleri
          buradan takip edin.
        </p>
      </div>
      <Group className={heroStyles.premiumHeroActions} wrap="wrap">
        <TextInput
          className={styles.heroSearch}
          classNames={{ input: styles.heroSearchInput }}
          placeholder="Ara..."
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          leftSection={<IconSearch size={16} color="rgba(255,255,255,0.35)" />}
        />
        <Button
          className={styles.heroSecondaryBtn}
          leftSection={<IconLayoutGridAdd size={16} />}
          onClick={onNewWorkspace}
        >
          Yeni Çalışma Alanı
        </Button>
        <Button
          className={styles.heroPrimaryBtn}
          leftSection={<IconPlus size={16} />}
          onClick={onNewDocument}
        >
          Yeni Doküman
        </Button>
      </Group>
    </section>
  );
}
