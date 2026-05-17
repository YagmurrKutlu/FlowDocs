import { Select, Switch } from '@mantine/core';
import type { ReactNode } from 'react';
import styles from '../pages/SettingsPage.module.css';

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.settingRow}>
      <div>
        <p className={styles.settingLabel}>{title}</p>
        {description ? <p className={styles.settingHint}>{description}</p> : null}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}

export function SettingSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch
      className={styles.switchRoot}
      classNames={{
        input: styles.switchInput,
        track: styles.switchTrack,
        thumb: styles.switchThumb,
      }}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.checked)}
      size="md"
    />
  );
}

export function SettingSelect<T extends string>({
  value,
  data,
  disabled,
  onChange,
}: {
  value: T;
  data: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      className={styles.selectField}
      value={value}
      data={data}
      disabled={disabled}
      onChange={(v) => {
        if (v) onChange(v as T);
      }}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
