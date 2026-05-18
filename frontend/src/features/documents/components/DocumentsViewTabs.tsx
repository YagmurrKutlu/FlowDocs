import type { DocumentsSummaryResponse, DocumentsView } from '../types/document.types';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsViewTabsProps = {
  activeView: DocumentsView;
  summary: DocumentsSummaryResponse | undefined;
  onChange: (view: DocumentsView) => void;
};

const TABS: Array<{
  view: DocumentsView;
  label: string;
  count: (s: DocumentsSummaryResponse | undefined) => number;
}> = [
  { view: 'all', label: 'Tümü', count: (s) => s?.totalDocuments ?? 0 },
  { view: 'owned', label: 'Sahip Olduklarım', count: (s) => s?.ownedDocuments ?? 0 },
  {
    view: 'shared',
    label: 'Benimle Paylaşılanlar',
    count: (s) => s?.sharedDocuments ?? 0,
  },
  {
    view: 'recent',
    label: 'Son Güncellenenler',
    count: (s) => s?.recentlyUpdated ?? 0,
  },
  { view: 'favorites', label: 'Favoriler', count: (s) => s?.favoriteDocuments ?? 0 },
];

export function DocumentsViewTabs({
  activeView,
  summary,
  onChange,
}: DocumentsViewTabsProps) {
  return (
    <div className={styles.tabsScroll}>
      <div className={styles.tabs} role="tablist" aria-label="Doküman görünümleri">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            role="tab"
            aria-selected={activeView === tab.view}
            className={`${styles.tab} ${activeView === tab.view ? styles.tabActive : ''}`}
            onClick={() => onChange(tab.view)}
          >
            {tab.label}
            <span className={styles.tabBadge}>{tab.count(summary)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
