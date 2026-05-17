import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useEffect, type PropsWithChildren } from 'react';
import { applyThemeToDocument } from '../../shared/theme/resolve-theme';
import { flowDocsTheme } from '../../shared/config/theme';

/** FlowDocs ships with a fixed dark color scheme (no user theme switching). */
export function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    applyThemeToDocument('dark');
  }, []);

  return (
    <MantineProvider theme={flowDocsTheme} forceColorScheme="dark">
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
