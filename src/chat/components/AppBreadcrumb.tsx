import { ChevronRight, Home } from 'lucide-react';
import { useStorageStore } from '@/store/storage-store';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getNodeDisplayName } from '@/lib/node-display-name';

export function AppBreadcrumb() {
  const { breadcrumbs, navigateToBreadcrumb, isLoading } = useStorageStore();

  const handleNavigate = async (path: string) => {
    if (!isLoading) {
      await navigateToBreadcrumb(path);
    }
  };

  // Don't render if breadcrumbs are not yet loaded
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isFirst = index === 0;
          const displayName = getNodeDisplayName(crumb);

          return (
            <div key={crumb.name} className="flex items-center gap-2">
              {index > 0 && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => handleNavigate(crumb.name)}
                  className="flex cursor-pointer items-center gap-1 hover:underline"
                  aria-disabled={isLoading}
                  style={{ pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 0.5 : 1 }}
                >
                  {isFirst && <Home className="h-4 w-4" />}
                  <span>{displayName}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}