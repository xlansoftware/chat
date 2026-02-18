"use client";

import { Mode, useModeStore } from "@/store/mode-store";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function SelectMode() {
  const { mode, setMode } = useModeStore();

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
      <TabsList>
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="raw">Text</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
