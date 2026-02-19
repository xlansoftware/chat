'use client';

import { AppBreadcrumb } from '@/components/AppBreadcrumb';
import { AppContent } from '@/components/AppContent';
import SelectMode from '@/components/SelectMode';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useStorageStore } from '@/store/storage-store';
import { useEffect } from 'react';

export default function Home() {
  const currentNode = useStorageStore(({ selectedFile, currentFolderContent }) => currentFolderContent.find((n) => n.name === selectedFile));
  const setCurrentFolder = useStorageStore(({ setCurrentFolder }) => setCurrentFolder);

  // Initialize the file system once on mount
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        // Load the root folder first
        await setCurrentFolder('/');
      } catch (error) {
        console.error('Failed to initialize file system:', error);
      }
    };

    initializeFileSystem();
  }, []); // Empty dependency array - only run once on mount

  const showSelectMode = currentNode?.type === "file" && currentNode?.name.toLowerCase().endsWith(".md");

  return (
    <main className="flex h-screen flex-col w-full">
      <header className="border-b">
        <div className="flex items-center gap-3 px-3 py-3">
          <SidebarTrigger />
          <AppBreadcrumb />
          <div className="flex-grow" />
          {showSelectMode && <SelectMode />}
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <AppContent />
        </div>
      </div>
    </main>
  );
}