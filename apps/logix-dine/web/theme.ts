"use client";

import { createTheme, MantineColorsTuple, CSSVariablesResolver } from "@mantine/core";

// Primary palette derived from Logix Dine brand favicon (#af73d7)
const dinePrimary: MantineColorsTuple = [
  "#f8f2fc",
  "#ede0f6",
  "#dcc0ee",
  "#cb9fe6",
  "#ba7fde",
  "#af73d7", // Key brand color (shade 5)
  "#9a55c8",
  "#853bb6",
  "#6f279f",
  "#5a1785",
];

export const theme = createTheme({
  primaryColor: "dinePrimary",
  primaryShade: { light: 5, dark: 4 },
  colors: {
    dinePrimary,
  },
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "700",
  },
  defaultRadius: "md",
  shadows: {
    xs: "none",
    sm: "none",
    md: "none",
    lg: "none",
    xl: "none",
  },
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
          backgroundOpacity: 0.55,
          blur: 5,
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "md",
      },
    },
    Card: {
      defaultProps: {
        withBorder: false,
        radius: "md",
        shadow: undefined,
      },
      styles: {
        root: {
          backgroundColor: "#ffffff",
          border: "none",
          boxShadow: "none",
        },
      },
    },
    Paper: {
      defaultProps: {
        withBorder: false,
        radius: "md",
        shadow: undefined,
      },
      styles: {
        root: {
          backgroundColor: "#ffffff",
          border: "none",
          boxShadow: "none",
        },
      },
    },
    Input: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
    PasswordInput: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
    Textarea: {
      styles: {
        input: {
          backgroundColor: "#ffffff",
          borderColor: "#ced4da",
        },
      },
    },
  },
});

export const cssResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "#F3F5F8",
  },
  dark: {
    "--mantine-color-body": "#1a1a1a",
  },
});
