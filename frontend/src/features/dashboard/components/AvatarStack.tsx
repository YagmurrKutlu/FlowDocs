import { Avatar, Group } from '@mantine/core';
import styles from './AvatarStack.module.css';

export type AvatarStackItem = {
  key: string;
  label: string;
  color: string;
};

type AvatarStackProps = {
  items: AvatarStackItem[];
  max?: number;
};

export function AvatarStack({ items, max = 3 }: AvatarStackProps) {
  const shown = items.slice(0, max);

  return (
    <Group gap={-10} className={styles.group}>
      {shown.map((item) => (
        <Avatar
          key={item.key}
          size={28}
          radius="xl"
          color={item.color}
          classNames={{ root: styles.avatar }}
          title={item.label}
        >
          {item.label.slice(0, 1).toUpperCase()}
        </Avatar>
      ))}
    </Group>
  );
}
