import type { PropsWithChildren } from 'react';
import { AccessibilitySettingsBridge } from '../../features/settings/components/AccessibilitySettingsBridge';
import { AuthBootstrap } from './AuthBootstrap';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AccessibilitySettingsBridge />
        <AuthBootstrap>{children}</AuthBootstrap>
      </QueryProvider>
    </ThemeProvider>
  );
}
