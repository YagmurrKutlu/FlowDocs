import { Card } from '@mantine/core';
import type { CardProps } from '@mantine/core';
import type { PropsWithChildren } from 'react';

export function AppCard({ children, style, ...props }: PropsWithChildren<CardProps>) {
  return (
    <Card
      radius="lg"
      shadow="sm"
      withBorder
      bg="var(--card-bg)"
      style={{ borderColor: 'var(--border-color)', ...style }}
      {...props}
    >
      {children}
    </Card>
  );
}
