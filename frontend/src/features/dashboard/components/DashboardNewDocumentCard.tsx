import type { KeyboardEvent } from 'react';
import pageStyles from '../pages/DashboardPage.module.css';

type DashboardNewDocumentCardProps = {
  onClick: () => void;
};

export function DashboardNewDocumentCard({ onClick }: DashboardNewDocumentCardProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={pageStyles.newDocCard}
      onClick={onClick}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label="Yeni doküman oluştur"
    >
      <span className={pageStyles.newDocPlus}>+</span>
      <span className={pageStyles.newDocLabel}>Yeni Doküman Oluştur</span>
    </div>
  );
}
