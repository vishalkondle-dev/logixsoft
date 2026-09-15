import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'md',
});

export const cssResolver: CSSVariablesResolver = () => ({
  light: {
    '--mantine-color-body': '#f8fafc',
  },
  dark: {
    '--mantine-color-body': '#0f172a',
    '--mantine-color-default': '#1e293b',
    '--mantine-color-default-hover': '#334155',
    '--mantine-color-default-border': '#334155',
  },
  variables: {},
});

