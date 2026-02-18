"use client";

import { CopyPlusIcon, DrillIcon, GitBranchIcon, MoreHorizontal, Pencil, PinIcon, PinOffIcon, Trash, Trash2 } from "lucide-react";

import { FolderNode, Node } from "@/types/nodes"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SidebarMenuAction, useSidebar } from "./ui/sidebar";
import { useStorageStore } from "@/store/storage-store";
import { changeFileName } from "@/lib/file-name";
import { useConfirm } from "@/components/confirm/ConfirmProvider";
import { usePrompt } from "@/components/prompt/PromptProvider";

export function NodeActions({ node }: { node: Node }) {

  const prompt = usePrompt();
  const confirm = useConfirm();

  const {
    currentFolder,
    setSelectedFile,
    deleteNode,
    writeNodeMetadata,
    readContent,
    writeContent,
    createNodeWithTitle,
    getNodeDisplayNameByPath,
    moveNode
  } = useStorageStore();


  const { isMobile } = useSidebar()


  const onDuplicate = async () => {
    const title = node.metadata?.title ? `${node.metadata?.title}` : `Branch`;
    const content = await readContent(node.name);

    if (node.type !== "file") return;

    const newNode = await createNodeWithTitle("file", `${title} - copy`, currentFolder);
    await writeContent(newNode.name, content);
    await setSelectedFile(newNode.name);

  };

  const onDrillIn = async () => {
    const title = node.metadata?.title ? `${node.metadata?.title}` : `Branch`;
    const content = await readContent(node.name);

    if (node.type === "file") {
      // create a dedicated folder for the branch
      const newFolder = await createNodeWithTitle("folder", title, currentFolder);
      await writeContent(newFolder.name, content);

      const newNode = await createNodeWithTitle("file", `${title} - branch`, newFolder.name);
      await writeContent(newNode.name, content);
      await setSelectedFile(newNode.name);

      // the original node is copied in the folder's content
      await deleteNode(node.name);
    } else {
      // just create node in the folder with copy of the content

      const newNode = await createNodeWithTitle("file", `${title} - branch`, node.name);
      await writeContent(newNode.name, content);
      await setSelectedFile(newNode.name);

    }
  };

  const onPin = async () => {
    // await saveThread({ ...thread, isPinned: !thread.isPinned });
  };

  const handleRename = async () => {
    const fullPath = node.name;
    const currentTitle = getNodeDisplayNameByPath(fullPath);
    const newTitle = await prompt({
      title: "Rename Item",
      description: "Enter a new name for this item.",
      initialValue: currentTitle,
      confirmText: "Rename",
    });
    if (!newTitle || newTitle === currentTitle) return;

    try {
      await writeNodeMetadata(node, { ...(node.metadata || {}), title: newTitle });
      const newName = changeFileName(node.name, newTitle);
      const result = await moveNode(fullPath, newName);
      console.log(result);

    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  const handleDelete = async () => {
    const fullPath = node.name;
    const displayName = getNodeDisplayNameByPath(fullPath);
    if (!await confirm({
      title: "Delete item",
      description: `Are you sure you want to delete "${displayName}"?`
    })) return;

    try {
      await deleteNode(fullPath);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <MoreHorizontal />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-48 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "end" : "start"}
      >
        {/* <DropdownMenuItem onClick={onPin}>
          {(!thread.isPinned) && <PinIcon className="text-muted-foreground" />}
          {(thread.isPinned) && <PinOffIcon className="text-muted-foreground" />}
          <span>Pin</span>
        </DropdownMenuItem> */}

        <DropdownMenuItem onClick={onDuplicate}>
          <CopyPlusIcon />
          <span>Duplicate</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onDrillIn}>
          <DrillIcon />
          <span>Drill in</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleRename}>
          <Pencil className="text-muted-foreground" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="text-muted-foreground" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
