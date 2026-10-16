import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "IPL Auction Simulator — Production Edition",
  description: "Real-time cricket auction simulator powered by Cloudflare Durable Objects, Workers AI & Next.js 16.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
