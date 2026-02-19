'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmProvider } from "@/components/confirm/ConfirmProvider";
import { PromptProvider } from "@/components/prompt/PromptProvider";

import './globals.css';
import { AppHistory } from '@/components/AppHistory';

import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>xlanchat</title>
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <ConfirmProvider>
              <PromptProvider>
                <AppSidebar />
                {children}
              </PromptProvider>
            </ConfirmProvider>
          </SidebarProvider>
        </ThemeProvider>
        <AppHistory />
      </body>
    </html>
  );
}
