import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import React from "react";
import type { Metadata, Viewport } from "next";
import { ColorSchemeScript } from "@mantine/core";
import { Providers } from "../components/providers";

export const metadata: Metadata = {
  title: "IPL Auction Simulator — Production Edition",
  description: "Real-time cricket auction simulator powered by Cloudflare Durable Objects, Workers AI & Mantine UI.",
  manifest: "/manifest.webmanifest",
  applicationName: "IPL Auction",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IPL Auction",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070b18",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
