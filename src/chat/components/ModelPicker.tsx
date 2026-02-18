"use client";

import { useEffect, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ChevronsUpDown, Cpu } from "lucide-react";
import { useModelStore } from "@/store/model-store";
import { useIsMobile } from "@/hooks/use-mobile";

export function ModelPicker() {
  const isMobile = useIsMobile();

  const {
    models,
    currentModel,
    loadModels,
    setCurrentModel,
  } = useModelStore();

  useEffect(() => {
    if (models.length === 0) {
      loadModels();
    }
  }, [models.length, loadModels]);

  const activeModel = useMemo(() => {
    return models.find((m) => m.name === currentModel);
  }, [models, currentModel]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Cpu className="size-4" />
              </div>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeModel?.name ?? "Select model"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeModel?.name ?? "No model selected"}
                </span>
              </div>

              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Models
            </DropdownMenuLabel>

            {models.map((model, index) => (
              <DropdownMenuItem
                key={model.name}
                onClick={() => setCurrentModel(model.name)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Cpu className="size-3.5 shrink-0" />
                </div>

                <div className="flex flex-col">
                  <span className="text-sm">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model["model-name"]}
                  </span>
                </div>

                {/* Optional keyboard hint */}
                <span className="ml-auto text-xs text-muted-foreground">
                  ⌘{index + 1}
                </span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Optional extension point */}
            <DropdownMenuItem disabled className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border">
                <Cpu className="size-3.5" />
              </div>
              <div className="text-muted-foreground font-medium">
                Models are managed server-side
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
