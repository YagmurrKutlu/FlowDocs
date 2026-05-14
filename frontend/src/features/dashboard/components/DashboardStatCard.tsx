import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
import styles from './DashboardStatCard.module.css';

type Accent = 'blue' | 'green' | 'orange' | 'white';

const accentClass: Record<Accent, string> = {
  blue: styles.valueBlue,
  green: styles.valueGreen,
  orange: styles.valueOrange,
  white: styles.valueWhite,
};

type DashboardStatCardProps = {
  value: ReactNode;
  label: string;
  accent: Accent;
};

export function DashboardStatCard({ value, label, accent }: DashboardStatCardProps) {
  return (
    <div className={styles.card}>
      <Text className={accentClass[accent]} component="div" fz={28} fw={700} lh={1.1}>
        {value}
      </Text>
      <Text className={styles.label} mt={8} size="sm">
        {label}
      </Text>
    </div>
  );
}
