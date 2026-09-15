import type { Metadata } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/nprogress/styles.css';
import '@mantine/charts/styles.css';
import 'mantine-datatable/styles.css';
import '@gfazioli/mantine-qr-code/styles.css';
import './globals.css';
import { Providers } from './providers';
import { ColorSchemeScript } from '@mantine/core';

export const metadata: Metadata = {
  title: 'Logixsoft UPI Gateway',
  description: 'Enterprise UPI Payment Gateway Integration with Paytm',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

