"use client";

import { createTheme, MantineColorsTuple, CSSVariablesResolver } from "@mantine/core";

// IPL Gold / Saffron accent
const iplGold: MantineColorsTuple = [
  "#fff9e6",
  "#fff0bf",
  "#ffe180",
  "#ffd040",
  "#ffc20e", // Key gold accent
  "#f5b400",
  "#d69c00",
  "#b07f00",
  "#8a6200",
  "#6b4a00",
];

// IPL Deep Stadium Blue / Navy
const iplBlue: MantineColorsTuple = [
  "#edf2ff",
  "#dbe4ff",
  "#bac8ff",
  "#91a7ff",
  "#748ffc",
  "#4c6ef5",
  "#3b5bdb",
  "#364fc7", // Primary shade
  "#2b3eb1",
  "#1e2b80",
];

export const theme = createTheme({
  primaryColor: "orange",
  primaryShade: { light: 6, dark: 6 },
  colors: {
    iplGold,
    iplBlue,
  },
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "800",
  },
  breakpoints: {
    xs: "30em", // 480px
    sm: "40em", // 640px
    md: "48em", // 768px
    lg: "64em", // 1024px
    xl: "80em", // 1280px
  },
  defaultRadius: "md",
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        overlayProps: {
          backgroundOpacity: 0.65,
          blur: 6,
        },
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
      },
    },
    Badge: {
      defaultProps: {
        radius: "sm",
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});

export const cssResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "#f8fafc",
    "--mantine-color-text": "#0f172a",
    "--ipl-surface": "#ffffff",
    "--ipl-border": "#e2e8f0",
  },
  dark: {
    "--mantine-color-body": "#090d16",
    "--mantine-color-text": "#f8fafc",
    "--ipl-surface": "#0f172a",
    "--ipl-border": "#1e293b",
  },
});
