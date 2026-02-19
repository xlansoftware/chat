import { Folder, File, Plus, ChevronRight, FolderPlusIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useStorageStore } from '@/store/storage-store';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { getNodeDisplayName } from '@/lib/node-display-name';
import { NodeActions } from './NodeActions';
import AppSidebarHeader from './AppSidebarHeader';
import AppSidebarFooter from './AppSidebarFooter';

export function AppSidebar() {
  const {
    currentFolder,
    selectedFile,
    currentFolderContent,
    isLoading,
    error,
    setCurrentFolder,
    navigateToFolder,
    setSelectedFile,
    createNodeWithTitle,
    clearError,
  } = useStorageStore();

  // Load root folder on mount
  useEffect(() => {
    setCurrentFolder('/');
  }, [setCurrentFolder]);

  const children = currentFolderContent;

  const handleCreateFolder = async () => {
    try {
      const newNode = await createNodeWithTitle("folder", "New folder", currentFolder);
      await navigateToFolder(newNode.name);
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleCreateFile = async () => {
    // const name = prompt('Enter file name:');
    // if (!name) return;

    try {
      const newNode = await createNodeWithTitle("file", "New chat", currentFolder);
      await setSelectedFile(newNode.name);
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  const handleNodeDoubleClick = async (fullPath: string, type: 'file' | 'folder') => {
    if (type === 'folder') {
      await navigateToFolder(fullPath);
    } else {
      await setSelectedFile(fullPath);
    }
  };

  const handleNodeClick = async (fullPath: string, type: 'file' | 'folder') => {
    await setSelectedFile(fullPath);

    // if (type === 'folder') {
    //   await navigateToFolder(fullPath);
    // } else {
    //   await setSelectedFile(fullPath);
    // }
  };

  return (
    <Sidebar>
      <AppSidebarHeader />

      <SidebarContent className="aui-sidebar-content">
        <nav className="flex flex-col gap-1 px-2">
          <div className="flex flex-row gap-1 w-full">
            <Button
              variant="secondary"
              className="flex-1 justify-start gap-2"
              onClick={handleCreateFile}
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
              New thread
            </Button>


            <Button
              variant="ghost"
              size="icon"
              aria-label="New folder"
              onClick={handleCreateFolder}
            >
              <FolderPlusIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="my-2 h-px bg-border" />

          <SidebarGroup>
            {/* <SidebarGroupLabel>{currentFolder || '/'}</SidebarGroupLabel> */}
            <SidebarGroupContent>
              {error && (
                <div className="mx-2 mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                  <p className="text-destructive">{error}</p>
                  <button
                    onClick={clearError}
                    className="text-destructive/80 underline mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {isLoading && children.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  Loading...
                </p>
              ) : children.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  This folder is empty
                </p>
              ) : (
                <SidebarMenu data-testid="sidebar-explorer">
                  {children.map((node) => (
                    <SidebarMenuItem key={node.name}>
                      <SidebarMenuButton
                        onDoubleClick={() => handleNodeDoubleClick(node.name, node.type)}
                        onClick={() => handleNodeClick(node.name, node.type)}
                        isActive={selectedFile === node.name}
                        disabled={isLoading}
                        data-type={node.type}
                        data-name={node.name}
                        data-selected={selectedFile === node.name}
                      >
                        {node.type === 'folder' ? (
                          <>
                            <Folder className="h-4 w-4 text-blue-500" />
                            <span className="flex-1 truncate">
                              {getNodeDisplayName(node)}
                            </span>
                            {/* <ChevronRight className="h-4 w-4 text-muted-foreground" /> */}
                          </>
                        ) : (
                          <>
                            <File className="h-4 w-4 text-gray-500" />
                            <span className="flex-1 truncate">
                              {getNodeDisplayName(node)}
                            </span>
                          </>
                        )}
                      </SidebarMenuButton>
                      <NodeActions node={node} />
                      {/* {node.type === 'folder' &&
                        <SidebarMenuAction><ChevronRight className="h-4 w-4 text-muted-foreground" /></SidebarMenuAction>
                      } */}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <AppSidebarFooter />
      {/* <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {children.length} {children.length === 1 ? 'item' : 'items'}
        </div>
      </SidebarFooter> */}
    </Sidebar>
  );
}