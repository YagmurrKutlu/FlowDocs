import { Card } from '@mantine/core';
import type { CardProps } from '@mantine/core';
import type { PropsWithChildren } from 'react';

export function AppCard({ children, ...props }: PropsWithChildren<CardProps>) {
  return (
    <Card
      radius="lg"
      shadow="sm"
      withBorder
      bg="dark.7"
      {...props}
    >
      {children}
    </Card>
  );
}
