"use client";

import { useUsageStore } from "@/store/usage-store";
import { Badge } from "./ui/badge";

export function UsagePanel() {
  const {
    usage,
    isLoading,
    error,
  } = useUsageStore();

  if (isLoading) return <Badge variant="secondary">...</Badge>;
  if (error) return (<div className="flex w-full flex-wrap justify-center gap-2">
    <Badge variant="secondary">tokens</Badge>
  </div>);

  return (
    <div className="flex w-full flex-wrap justify-center gap-2">
      <Badge variant="secondary">{`${usage?.totalUsage?.totalTokens ?? ""} tokens`}</Badge>
      <Badge variant="outline">{`${usage?.tokensPerSecond ?? ""} t/sec`}</Badge>
    </div>
  );
}
