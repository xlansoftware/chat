'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmProvider } from "@/components/confirm/ConfirmProvider";
import { PromptProvider } from "@/components/prompt/PromptProvider";

import './globals.css';
import { AppHistory } from '@/components/AppHistory';

import { ThemeProvider } from "next-themes"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>xlanchat</title>
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
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
