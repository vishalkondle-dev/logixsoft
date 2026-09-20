"use client";

import React, { ReactNode, useState } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { NavigationProgress } from "@mantine/nprogress";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { theme, cssResolver } from "@/theme";
import { AuthProvider } from "@/lib/auth-context";
import { RestaurantProvider } from "@/lib/restaurant-context";
import { AppShellLayout } from "@/components/layout/app-shell";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} cssVariablesResolver={cssResolver}>
        <ModalsProvider>
          <NavigationProgress />
          <Notifications position="top-right" />
          <AuthProvider>
            <RestaurantProvider>
              <AppShellLayout>{children}</AppShellLayout>
            </RestaurantProvider>
          </AuthProvider>
        </ModalsProvider>
      </MantineProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
