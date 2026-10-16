import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import React from "react";
import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { Providers } from "../components/providers";

export const metadata: Metadata = {
  title: "IPL Auction Simulator — Production Edition",
  description: "Real-time cricket auction simulator powered by Cloudflare Durable Objects, Workers AI & Mantine UI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-mantine-color-scheme="dark" className="dark">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
