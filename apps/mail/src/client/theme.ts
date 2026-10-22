import { createTheme, MantineColorsTuple } from "@mantine/core";

const teal: MantineColorsTuple = [
  "#e6fcf5",
  "#c3fae8",
  "#96f2d7",
  "#63e6be",
  "#38d9a9",
  "#20c997",
  "#12b886",
  "#0ca678",
  "#099268",
  "#087f5b",
];

export const theme = createTheme({
  primaryColor: "teal",
  colors: {
    teal,
  },
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', Courier, monospace",
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Button: {
      defaultProps: {
        radius: "md",
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
  },
});
