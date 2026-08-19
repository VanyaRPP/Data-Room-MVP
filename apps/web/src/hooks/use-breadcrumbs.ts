import { useQuery } from "@tanstack/react-query";
import type { BreadcrumbDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useBreadcrumbs(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.breadcrumbs(nodeId),
    queryFn: () => apiFetch<BreadcrumbDto[]>(`/nodes/${nodeId}/breadcrumbs`),
  });
}
