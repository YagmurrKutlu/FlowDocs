import type { ReactNode } from 'react';
import accentStyles from '../../../shared/styles/stat-card-accents.module.css';
import styles from './DashboardStatCard.module.css';

export type DashboardStatAccent = 'blue' | 'emerald' | 'orange' | 'purple';

const cardAccentClass: Record<DashboardStatAccent, string> = {
  blue: accentStyles.statCardBlue,
  emerald: accentStyles.statCardEmerald,
  orange: accentStyles.statCardOrange,
  purple: accentStyles.statCardPurple,
};

const valueAccentClass: Record<DashboardStatAccent, string> = {
  blue: accentStyles.statValueBlue,
  emerald: accentStyles.statValueEmerald,
  orange: accentStyles.statValueOrange,
  purple: accentStyles.statValuePurple,
};

type DashboardStatCardProps = {
  value: ReactNode;
  label: string;
  accent: DashboardStatAccent;
};

export function DashboardStatCard({ value, label, accent }: DashboardStatCardProps) {
  return (
    <div className={`${accentStyles.statCard} ${cardAccentClass[accent]} ${styles.card}`}>
      <p className={`${accentStyles.statValue} ${valueAccentClass[accent]}`}>{value}</p>
      <p className={accentStyles.statLabel}>{label}</p>
    </div>
  );
}
