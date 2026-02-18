'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConfirmProvider } from "@/components/confirm/ConfirmProvider";
import { PromptProvider } from "@/components/prompt/PromptProvider";

import './globals.css';
import { AppHistory } from '@/components/AppHistory';

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
        <SidebarProvider>
          <ConfirmProvider>
            <PromptProvider>
              <AppSidebar />
              {children}
            </PromptProvider>
          </ConfirmProvider>
        </SidebarProvider>
        <AppHistory />
      </body>
    </html>
  );
}
