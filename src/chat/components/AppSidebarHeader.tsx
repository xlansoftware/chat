import { SidebarHeader } from "./ui/sidebar";
import { ModelPicker } from "./ModelPicker";

export default function AppSidebarHeader() {
  return (
    <SidebarHeader className="aui-sidebar-header mb-2 border-b">
      <ModelPicker />
    </SidebarHeader>
  )
}