import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { PropsWithChildren } from 'react';
import { flowDocsTheme } from '../../shared/config/theme';

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider defaultColorScheme="dark" theme={flowDocsTheme}>
        <Notifications position="top-right" />
        {children}
      </MantineProvider>
    </>
  );
}
