import type { PropsWithChildren } from 'react';
import { AuthBootstrap } from './AuthBootstrap';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthBootstrap>{children}</AuthBootstrap>
      </QueryProvider>
    </ThemeProvider>
  );
}
