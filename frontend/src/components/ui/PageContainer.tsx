import { Container } from '@mantine/core';
import type { PropsWithChildren } from 'react';

export function PageContainer({ children }: PropsWithChildren) {
  return (
    <Container fluid px="lg" py="lg">
      {children}
    </Container>
  );
}
