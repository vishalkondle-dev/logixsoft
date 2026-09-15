'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { NavigationProgress } from '@mantine/nprogress';
import { ReactNode } from 'react';
import { theme, cssResolver } from './theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssResolver} defaultColorScheme="light">
      <NavigationProgress />
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}

