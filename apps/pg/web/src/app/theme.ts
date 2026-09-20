import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'md',
  components: {
    Card: {
      defaultProps: {
        withBorder: false,
        radius: 'md',
      },
      styles: {
        root: {
          backgroundColor: '#ffffff',
          border: 'none',
        },
      },
    },
    Paper: {
      defaultProps: {
        withBorder: false,
        radius: 'md',
      },
      styles: {
        root: {
          backgroundColor: '#ffffff',
          border: 'none',
        },
      },
    },
    Input: {
      styles: {
        input: {
          backgroundColor: '#ffffff',
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: '#ffffff',
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: '#ffffff',
        },
      },
    },
  },
});

export const cssResolver: CSSVariablesResolver = () => ({
  light: {
    '--mantine-color-body': '#F3F5F8',
  },
  dark: {
    '--mantine-color-body': '#0f172a',
    '--mantine-color-default': '#1e293b',
    '--mantine-color-default-hover': '#334155',
    '--mantine-color-default-border': '#334155',
  },
  variables: {},
});

