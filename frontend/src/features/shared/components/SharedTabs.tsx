import type { SharedTab } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

type SharedTabsProps = {
  activeTab: SharedTab;
  withMeCount: number;
  byMeCount: number;
  onChange: (tab: SharedTab) => void;
};

export function SharedTabs({
  activeTab,
  withMeCount,
  byMeCount,
  onChange,
}: SharedTabsProps) {
  return (
    <div className={styles.tabsScroll}>
      <div className={styles.tabs} role="tablist" aria-label="Paylaşılanlar sekmeleri">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'with-me'}
        className={`${styles.tab} ${activeTab === 'with-me' ? styles.tabActive : ''}`}
        onClick={() => onChange('with-me')}
      >
        Benimle Paylaşılanlar
        <span className={styles.tabBadge}>{withMeCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'by-me'}
        className={`${styles.tab} ${activeTab === 'by-me' ? styles.tabActive : ''}`}
        onClick={() => onChange('by-me')}
      >
        Benim Paylaştıklarım
        <span className={styles.tabBadge}>{byMeCount}</span>
      </button>
      </div>
    </div>
  );
}
